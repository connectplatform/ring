import 'server-only' // Ensures this module is not included in client bundles

import { auth } from '@/auth'
import { assertVerificationAdmin } from '@/features/verification/lib/assert-verification-admin'
import { db } from '@/lib/database'
import { EntityPermissionError } from '@/lib/errors'
import {
  createVerificationProcedure,
  persistVerificationProcedure,
  VerificationProcedureError,
} from '@/features/verification/services/create-verification-procedure'

// Constant note to explain admin manual verification in logs and records
export const ADMIN_MANUAL_VERIFICATION_NOTE = 'verified by human admin manually'

// Defines the input parameters required for admin manual user verification
export interface AdminManualUserVerificationInput {
  targetUserId: string      // The user whose verification status will be changed
  isVerified: boolean       // Determines whether to set or unset verification
  adminUserId: string       // ID of the admin performing the operation
  adminName?: string | null // Admin's name (optional)
  adminEmail: string        // Admin's email
  /** ISO timestamp from admin client clock */
  verifiedAtLocal?: string  // Client-side local ISO timestamp (for audit)
  /** Human-readable local time string from admin client */
  verifiedAtLocalDisplay?: string // Human-friendly display of above timestamp
}

/**
 * Ensures the operating user has admin privileges and fetches their identity.
 * Throws EntityPermissionError if not authenticated.
 */
export async function assertAdminManualVerificationAccess(): Promise<{
  adminUserId: string
  adminName?: string | null
  adminEmail: string
}> {
  // Get auth session details
  const session = await auth()
  // Asserts that current user is a verification admin; throws if not
  const adminUserId = await assertVerificationAdmin()
  if (!session?.user) {
    throw new EntityPermissionError('Admin access required')
  }
  // Return fetched admin details for audit purposes
  return {
    adminUserId,
    adminName: session.user.name,
    adminEmail: session.user.email || '',
  }
}

/**
 * Handles marking a user as verified or unverified manually by an admin.
 * @param input - Required admin/user data and verification intent
 * @returns success state and procedure information
 */
export async function setAdminManualUserVerification(
  input: AdminManualUserVerificationInput,
): Promise<{ success: true; procedureNumber?: string; isVerified: boolean }> {
  // Fetch target user doc to ensure existence
  const userResult = await db().readDoc<Record<string, unknown>>('users', input.targetUserId)
  if (!userResult.success || !userResult.data) {
    throw new VerificationProcedureError('User not found') // Fail fast if user doesn't exist
  }

  const now = new Date().toISOString() // Generate UTC timestamp for all audit marks

  // If admin wants to set user to UNVERIFIED state
  if (!input.isVerified) {
    // Set verified status to false and clear verification metadata
    const updateResult = await db().updateDoc(
      'users',
      input.targetUserId,
      {
        isVerified: false,
        kycVerification: {
          status: 'not_started',
          level: 'none',
          verifiedAt: null,
          manualVerification: null,
        },
      },
      { merge: true },
    )

    if (!updateResult.success) {
      throw new VerificationProcedureError('Failed to clear user verification status')
    }

    // Return indicating user is now unverified
    return { success: true, isVerified: false }
  }

  // If admin is verifying the user, initiate a verification procedure
  const procedure = await createVerificationProcedure({
    subjectType: 'user_kyc',
    subjectId: input.targetUserId,
    applicantUserId: input.targetUserId,
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
  })

  // Prepare forensics details for audit trail
  const forensicsDetail = {
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
    adminName: input.adminName ?? null,
    adminEmail: input.adminEmail,
    verifiedAtUtc: now,
    verifiedAtLocal: input.verifiedAtLocal ?? null,
    verifiedAtLocalDisplay: input.verifiedAtLocalDisplay ?? null,
  }

  // Mark the verification procedure as approved and persist details
  const approved = await persistVerificationProcedure({
    ...procedure,
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
    completedAt: now,
    reviewerUserId: input.adminUserId,
    note: ADMIN_MANUAL_VERIFICATION_NOTE,
    statusHistory: [
      ...(procedure.statusHistory ?? []), // Preserve existing history if any
      {
        status: 'submitted',
        at: now,
        actorUserId: input.adminUserId,
        note: ADMIN_MANUAL_VERIFICATION_NOTE,
      },
      {
        status: 'approved',
        at: now,
        actorUserId: input.adminUserId,
        note: ADMIN_MANUAL_VERIFICATION_NOTE,
      },
    ],
    forensics: [
      ...(procedure.forensics ?? []), // Append forensics info for audit
      {
        at: now,
        actorUserId: input.adminUserId,
        action: 'admin_manual_verify',
        detail: forensicsDetail,
      },
    ],
  })

  // Update the user record to reflect verification, linking procedureNumber for traceability
  const updateResult = await db().updateDoc(
    'users',
    input.targetUserId,
    {
      isVerified: true,
      kycVerification: {
        status: 'approved',
        level: 'standard',
        verifiedAt: now,
        procedureNumber: approved.procedureNumber,
        manualVerification: forensicsDetail,
      },
    },
    { merge: true },
  )

  if (!updateResult.success) {
    throw new VerificationProcedureError('Failed to update user verification status')
  }

  // Trigger a reward credit event if user was verified
  if (input.isVerified) {
    const userData = userResult.data as Record<string, unknown>
    // Dynamically import reward credit module only when needed (saves bundle weight)
    const { enqueueRewardCreditAddEvent } = await import('@/lib/wallet/reward-credit-service')
    void enqueueRewardCreditAddEvent({
      userId: input.targetUserId,
      trigger: 'adminVerify',
      username: (userData.username as string) ?? null,
      isVerified: true,
    }).catch(() => undefined) // Silently ignore errors, do not block verification on credit events

    try {
      const { appendEvent } = await import('@/lib/events/event-log.server')
      await appendEvent({
        type: 'user_verified',
        userId: input.targetUserId,
        reversible: true,
        payload: {
          email: userData.email,
          procedureNumber: approved.procedureNumber,
          trigger: 'adminVerify',
        },
      })
    } catch {
      // non-blocking
    }
  }

  // Return operation result with procedure reference and verified status for frontend updating
  return { success: true, procedureNumber: approved.procedureNumber, isVerified: true }
}

// TODO: Consider Next.js 16/React 19 improvements as applicable:
// - If/when hooks or server actions are used for admin flows, ensure this logic is in a server action (recommended for security)
// - Evaluate replacing dynamic import of the reward credit service (if desired for SSR predictability), but currently fine for isolating a side-effect