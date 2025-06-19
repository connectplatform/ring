import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { auth } from '@/auth';
import { entityConverter } from '@/lib/converters/entity-converter';
import { UserRole } from '@/features/auth/types';
import { checkEntityOwnership } from '../utils/entity-utils';

/**
 * Updates an entity by its ID in Firestore, enforcing role-based access control.
 * 
 * @param {string} id - The unique identifier of the entity to update.
 * @param {Partial<Entity>} data - Partial Entity object containing the fields to update.
 * @returns {Promise<boolean>} A promise that resolves to true if the update was successful, false otherwise.
 * @throws {Error} If the user is not authenticated or lacks the necessary permissions.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Retrieves the current entity data from Firestore.
 * 3. Checks if the user is either the entity creator or an admin.
 * 4. Updates the entity with the provided data using Firestore's merge functionality.
 * 5. Returns true if the update was successful, false otherwise.
 * 
 * User steps:
 * 1. User attempts to update an entity (e.g., through a form submission or API call).
 * 2. The function checks if the user is authenticated and has the necessary permissions.
 * 3. If authorized, the function updates the entity with the provided data.
 * 4. The user receives feedback on whether the update was successful.
 * 
 * Note: Only the entity creator or users with ADMIN role can update entities.
 */
export async function updateEntity(id: string, data: Partial<Entity>): Promise<boolean> {
  try {
    console.log('Services: updateEntity - Starting update for ID:', id);

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: updateEntity - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;
    const userId = session.user.id;

    console.log(`Services: updateEntity - User authenticated with role ${userRole} and ID ${userId}`);

    // Step 2: Check permissions
    if (userRole !== UserRole.ADMIN && !(await checkEntityOwnership(userId, id))) {
      console.error('Services: updateEntity - Access denied for non-admin user attempting to update entity they did not create');
      throw new Error('Access denied. Only the entity creator or an admin can update this entity.');
    }

    // Step 3: Access Firestore and update the entity
    const adminDb = await getAdminDb();
    const docRef = adminDb.collection('entities').doc(id).withConverter(entityConverter);
    
    await docRef.set(data, { merge: true });
    console.log('Services: updateEntity - Entity updated successfully');

    return true; // Indicate successful update

  } catch (error) {
    console.error('Services: updateEntity - Error updating entity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while updating entity');
  }
}

