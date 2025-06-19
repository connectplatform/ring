import { getAdminDb } from '@/lib/firebase-admin.server';
import { entityConverter } from '@/lib/converters/entity-converter';

/**
 * Checks if the current user is the owner of the specified entity.
 * 
 * @param {string} userId - The ID of the user to check.
 * @param {string} entityId - The ID of the entity to check ownership for.
 * @returns {Promise<boolean>} True if the user is the owner, false otherwise.
 */
export async function checkEntityOwnership(userId: string, entityId: string): Promise<boolean> {
  const adminDb = await getAdminDb();
  const docRef = adminDb.collection('entities').doc(entityId).withConverter(entityConverter);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return false;
  }

  const entity = docSnap.data();
  return entity?.addedBy === userId;
}

