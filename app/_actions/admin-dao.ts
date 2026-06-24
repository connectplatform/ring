'use server'

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

function revalidatePoolPaths() {
  revalidatePath('/dao')
  revalidatePath('/admin/dao')
}

async function assertPlatformAdmin() {
  const session = await auth()
  if (!session?.user?.id || !isPlatformAdmin(session.user.role)) {
    return { ok: false as const, error: 'Forbidden' }
  }
  return { ok: true as const }
}

export async function createPublicPoolAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; poolId?: string }> {
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  const labelsRaw = String(formData.get('labels') ?? '')
  const labels = labelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const parsed = PublicPoolAdminCreateSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    pool_kind: formData.get('pool_kind') || 'future_feature',
    pool_slug: formData.get('pool_slug') || undefined,
    goal_hours: formData.get('goal_hours'),
    labels,
    doc_path: formData.get('doc_path') || null,
    funding_mode: formData.get('funding_mode') || 'donation',
    status: formData.get('status') || 'open',
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors.join(', ') || 'Invalid input' }
  }

  try {
    const pool = await createAdminPublicPool(parsed.data)
    revalidatePoolPaths()
    return { success: true, poolId: pool.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pool',
    }
  }
}

export async function updatePublicPoolAction(
  poolId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const gate = await assertPlatformAdmin()
  if (!gate.ok) {
    return { success: false, error: gate.error }
  }

  const labelsRaw = formData.get('labels')
  const labels =
    labelsRaw != null
      ? String(labelsRaw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

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

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().formErrors.join(', ') || 'Invalid input' }
  }

  try {
    await updateAdminPublicPool(poolId, parsed.data)
    revalidatePoolPaths()
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pool',
    }
  }
}

export async function deletePublicPoolAction(
  poolId: string,
): Promise<{ success: boolean; error?: string }> {
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
}

export async function updatePublicPoolStatusAction(
  poolId: string,
  status: PublicPool['status'],
): Promise<{ success: boolean; error?: string }> {
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
}
