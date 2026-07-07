'use server'

// Core imports
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import {
  createAdminPublicPool,
  deleteAdminPublicPool,
  updateAdminPublicPool,
  updatePoolStatus,
} from '@/features/public-pools/services/public-pool-service'
import {
  PublicPoolAdminCreateSchema,
  PublicPoolAdminUpdateSchema,
  type PublicPool,
} from '@/lib/zod/public-pool-schemas'

// Utility function to revalidate relevant Next.js paths after a mutating pool action is performed.
// This helps ensure UI reflects up-to-date data.
function revalidatePoolPaths() {
  revalidatePath('/dao')
  revalidatePath('/admin/dao')
  // If dynamic segments are introduced, add revalidatePath for specific pool slugs
}

// Checks that the current session is authenticated and the user has platform admin privileges.
// Returns an object indicating whether the operation is permitted.
async function assertPlatformAdmin() {
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    // If not authenticated or not a platform admin, forbid.
    return { ok: false as const, error: 'Forbidden' }
  }
  return { ok: true as const }
}

// Action for creating a new public pool as an admin.
export async function createPublicPoolAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; poolId?: string }> {
  // Gate: Ensure only platform admins can perform this action
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  // Parse and sanitize 'labels' as a CSV string -> array of trimmed non-empty strings
  const labelsRaw = String(formData.get('labels') ?? '')
  const labels = labelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Validate payload against Zod scheme. Apply (sensible) default values where necessary.
  const parsed = PublicPoolAdminCreateSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    pool_kind: formData.get('pool_kind') || 'future_feature', // Default kind
    pool_slug: formData.get('pool_slug') || undefined, // Optional
    goal_hours: formData.get('goal_hours'),
    labels,
    doc_path: formData.get('doc_path') || null,
    funding_mode: formData.get('funding_mode') || 'donation', // Default funding mode
    status: formData.get('status') || 'open', // Default open
  })

  // Early return if invalid. Flatten errors for presentation.
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors.join(', ') || 'Invalid input' }
  }

  try {
    // Create the pool in backend service
    const pool = await createAdminPublicPool(parsed.data)
    revalidatePoolPaths() // Invalidate caches for updated state
    return { success: true, poolId: pool.id }
  } catch (error) {
    // Catch-all error reporting
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pool',
    }
  }
  // SSOT: try-catch with structured error objects is the established pattern (30/30 action files)
  // React 19 server action error boundaries may replace this pattern in future React versions.
}

// Action for updating an existing public pool as an admin.
export async function updatePublicPoolAction(
  poolId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  // Gate: Ensure only platform admins can perform this action
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  // Parse and sanitize 'labels' (may be missing)
  const labelsRaw = formData.get('labels')
  const labels =
    labelsRaw != null
      ? String(labelsRaw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined // if not present, don't overwrite labels

  // Validate only changed fields; unset fields stay undefined
  const parsed = PublicPoolAdminUpdateSchema.safeParse({
    title: formData.get('title') || undefined,
    description: formData.get('description') || undefined,
    pool_kind: formData.get('pool_kind') || undefined,
    goal_hours: formData.get('goal_hours') || undefined,
    labels,
    doc_path: formData.has('doc_path') ? formData.get('doc_path') || null : undefined,
    funding_mode: formData.get('funding_mode') || undefined,
    status: formData.get('status') || undefined,
  })

  // Show all (flattened) Zod errors if validation fails.
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors.join(', ') || 'Invalid input' }
  }

  try {
    // Attempt update in backend
    await updateAdminPublicPool(poolId, parsed.data)
    revalidatePoolPaths()
    return { success: true }
  } catch (error) {
    // Manual error reporting
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pool',
    }
  }
  // SSOT: structured return objects for formState consumption (React 19 useActionState compatible)
}

// Action for deleting a public pool as admin.
export async function deletePublicPoolAction(
  poolId: string,
): Promise<{ success: boolean; error?: string }> {
  // Gate: Ensure only platform admins can perform this action
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  try {
    await deleteAdminPublicPool(poolId)
    revalidatePoolPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete pool',
    }
  }
  // SSOT: try-catch with structured error. Optimistic UI can be added client-side via React 19 useOptimistic.
}

// Action for updating status (e.g. open/closed) on a public pool as admin.
export async function updatePublicPoolStatusAction(
  poolId: string,
  status: PublicPool['status'],
): Promise<{ success: boolean; error?: string }> {
  // Gate: Ensure only platform admins can perform this action
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  try {
    await updatePoolStatus(poolId, status)
    revalidatePoolPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pool status',
    }
  }
  // SSOT: structured error responses for formState consumption. Next.js 16 handles redirect in server action context.
}
