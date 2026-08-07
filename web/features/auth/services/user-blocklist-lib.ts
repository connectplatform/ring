import { cache } from 'react'
import { db } from '@/lib/database'
import { logRingError } from '@/lib/errors'

/** Blocked user ids stored on the blocker’s user JSONB (mirrors blockedEntityIds). */
export const getBlockedUserIds = cache(async (userId: string): Promise<string[]> => {
  try {
    const result = await db().readDoc<{ blockedUserIds?: string[] } & { id: string }>(
      'users',
      userId,
    )
    if (!result.success || !result.data) return []
    return Array.isArray(result.data.blockedUserIds) ? result.data.blockedUserIds : []
  } catch (error) {
    logRingError(error, 'getBlockedUserIds')
    return []
  }
})

export async function appendBlockedUser(
  blockerId: string,
  targetUserId: string,
): Promise<void> {
  const current = await getBlockedUserIds(blockerId)
  if (current.includes(targetUserId)) return

  const result = await db().updateDoc(
    'users',
    blockerId,
    { blockedUserIds: [...current, targetUserId] },
    { merge: true },
  )
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to update user block list')
  }
}

export async function removeBlockedUser(
  blockerId: string,
  targetUserId: string,
): Promise<void> {
  const current = await getBlockedUserIds(blockerId)
  if (!current.includes(targetUserId)) return

  const result = await db().updateDoc(
    'users',
    blockerId,
    { blockedUserIds: current.filter((id) => id !== targetUserId) },
    { merge: true },
  )
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to update user block list')
  }
}

/** True when either user has blocked the other (either direction). */
export async function isDirectMessagingBlockedBetween(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false
  const [aBlocks, bBlocks] = await Promise.all([
    getBlockedUserIds(userA),
    getBlockedUserIds(userB),
  ])
  return aBlocks.includes(userB) || bBlocks.includes(userA)
}
