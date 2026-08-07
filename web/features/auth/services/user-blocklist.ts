'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { logRingError } from '@/lib/errors'
import {
  appendBlockedUser,
  getBlockedUserIds,
  removeBlockedUser,
} from '@/features/auth/services/user-blocklist-lib'

/**
 * Server Actions only. Import readers (`getBlockedUserIds`,
 * `isDirectMessagingBlockedBetween`) from `user-blocklist-lib` — Next.js
 * forbids re-exporting non-async helpers from a `"use server"` module.
 */
export type BlockUserActionResult = { success: true } | { success: false; error: string }

export async function blockUserById(targetUserId: string): Promise<BlockUserActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }
  const blockerId = session.user.id
  const target = targetUserId.trim()
  if (!target) return { success: false, error: 'Target required' }
  if (target === blockerId) return { success: false, error: 'Cannot block yourself' }

  try {
    const exists = await db().readDoc('users', target)
    if (!exists.success || !exists.data) {
      return { success: false, error: 'User not found' }
    }
    await appendBlockedUser(blockerId, target)
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    logRingError(error, 'blockUserById')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to block user',
    }
  }
}

export async function unblockUserById(targetUserId: string): Promise<BlockUserActionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' }
  }
  const blockerId = session.user.id
  const target = targetUserId.trim()
  if (!target) return { success: false, error: 'Target required' }
  if (target === blockerId) return { success: false, error: 'Cannot unblock yourself' }

  try {
    await removeBlockedUser(blockerId, target)
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    logRingError(error, 'unblockUserById')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unblock user',
    }
  }
}

/** Whether the current session user has blocked `targetUserId`. */
export async function hasBlockedUser(targetUserId: string): Promise<boolean> {
  const session = await auth().catch(() => null)
  if (!session?.user?.id || !targetUserId) return false
  const ids = await getBlockedUserIds(session.user.id)
  return ids.includes(targetUserId)
}
