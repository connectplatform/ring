import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';

/**
 * Checks if the current user is the owner of the specified entity.
 * Ring-native implementation using DatabaseService
 * 
 * @param {string} userId - The ID of the user to check.
 * @param {string} entityId - The ID of the entity to check ownership for.
 * @returns {Promise<boolean>} True if the user is the owner, false otherwise.
 */
export async function checkEntityOwnership(userId: string, entityId: string): Promise<boolean> {
  await initializeDatabase();
  const db = getDatabaseService();

  const result = await db.read('entities', entityId);

  if (!result.success || !result.data) {
    return false;
  }

  const entity = result.data as any;
  return entity?.addedBy === userId;
}

