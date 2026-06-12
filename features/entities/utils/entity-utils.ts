import { db } from '@/lib/database'

/**
 * Checks if the current user is the owner of the specified entity.
 * Ring-native implementation using DatabaseService command layer
 *
 * @param {string} userId - The ID of the user to check.
 * @param {string} entityId - The ID of the entity to check ownership for.
 * @returns {Promise<boolean>} True if the user is the owner, false otherwise.
 */
export async function checkEntityOwnership(userId: string, entityId: string): Promise<boolean> {
  const result = await db().findDocById<{ addedBy?: string } & { id: string }>('entities', entityId)

  if (!result.success || !result.data) {
    return false
  }

  return result.data.addedBy === userId
}
