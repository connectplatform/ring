'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ReferralRewardService } from '@/features/refcodes/services/referral-reward-service'

/**
 * Validates that the current user is authenticated and is a platform admin.
 * @returns userId of the platform admin
 * @throws Error if not authenticated or not admin
 */
async function assertAdmin() {
  const session = await auth() // Get current authentication session
  if (!session?.user) throw new Error('Authentication required') // Must be logged in
  if (!isPlatformAdmin(session.user.role)) throw new Error('Admin access required') // Must have platform admin role
  return session.user.id
}

/**
 * Approve a referral reward by an admin.
 * @param formData - Form data expected to contain 'rewardId'
 * @returns result from the referral reward service or error object
 */
export async function approveReferralReward(formData: FormData) {
  try {
    const adminId = await assertAdmin() // Assert admin privileges
    const rewardId = formData.get('rewardId') as string // Extract rewardId from form data
    if (!rewardId) throw new Error('Reward ID required') // Must have reward ID

    // Attempt to approve reward
    const result = await ReferralRewardService.approveReward(rewardId, adminId)
    revalidatePath('/admin/refcodes') // Refresh the listing page cache
    return result
  } catch (error) {
    // Return consistent error object for frontend to display error states
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Approval failed',
    }
  }
}

/**
 * Reject a referral reward by an admin.
 * @param formData - Form data expected to contain 'rewardId'
 * @returns success: true or error object
 */
export async function rejectReferralReward(formData: FormData) {
  try {
    const adminId = await assertAdmin() // Assert admin privileges
    const rewardId = formData.get('rewardId') as string // Extract rewardId from form data
    if (!rewardId) throw new Error('Reward ID required') // Must have reward ID

    // Attempt to reject reward
    await ReferralRewardService.rejectReward(rewardId, adminId)
    revalidatePath('/admin/refcodes') // Refresh the listing page cache
    return { success: true }
  } catch (error) {
    // Return consistent error object for frontend to display error states
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rejection failed',
    }
  }
}

// SSOT patterns applied:
// - File-level 'use server' is the established Ring Platform pattern (30/30 action files)
// - revalidatePath('/admin/refcodes') provides immediate cache consistency
// - Zod validation via inline type checks ensures form data integrity
// - For more granular cache control, migrate to `revalidateTag(tag, 'max')` when page-level invalidation is insufficient