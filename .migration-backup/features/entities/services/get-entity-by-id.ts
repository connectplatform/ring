import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity, SerializedEntity, EntityType } from '@/features/entities/types';
import { getServerAuthSession } from '@/auth'; // Consistent session handling
import { entityConverter } from '@/lib/converters/entity-converter';
import { UserRole } from '@/features/auth/types';

/**
 * Fetches an entity by its ID from Firestore, enforcing role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role for access control.
 * 3. Queries Firestore for the entity with the given ID.
 * 4. Enforces confidentiality rules based on the user's role and the entity's status.
 * 5. Returns the entity if found and the user has permission, or null if not found.
 * 
 * User steps:
 * 1. User requests to view an entity (e.g., by navigating to an entity page).
 * 2. The application calls this function with the entity ID.
 * 3. If the user is authenticated and has the right permissions, they see the entity details.
 * 4. If the user lacks permissions or the entity doesn't exist, appropriate error handling occurs.
 * 
 * @param {string} id - The unique identifier of the entity to fetch.
 * @returns {Promise<Entity | null>} A promise that resolves to the Entity object if found, or null if not found.
 * @throws {Error} If the user is not authenticated or lacks the necessary permissions.
 * 
 * Note: Confidential entities can only be accessed by users with CONFIDENTIAL or ADMIN roles.
 *       Non-confidential entities can be accessed by all authenticated users.
 */
export async function getEntityById(id: string): Promise<Entity | null> {
  try {
    console.log('Services: getEntityById - Fetching entity with ID:', id);

    // Step 1: Authenticate and get user session
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.error('Services: getEntityById - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;
    console.log(`Services: getEntityById - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore and get the entity document
    const adminDb = getAdminDb(); // Using getAdminDb directly without await
    const docRef = adminDb.collection('entities').doc(id).withConverter(entityConverter);
    const docSnap = await docRef.get();

    // Step 3: Check if the entity exists
    if (!docSnap.exists) {
      console.warn('Services: getEntityById - No entity found with ID:', id);
      return null;
    }

    // Step 4: Get the entity data and check permissions
    const entity = docSnap.data();
    if (entity) {
      if (entity.isConfidential && userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
        console.error('Services: getEntityById - Access denied for confidential entity');
        throw new Error('Access denied. You do not have permission to view this confidential entity.');
      }

      console.log('Services: getEntityById - Entity retrieved successfully');
      return entity;
    }

    console.warn('Services: getEntityById - Entity data is null');
    return null;
  } catch (error) {
    console.error('Services: getEntityById - Error fetching entity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching entity');
  }
}

/**
 * Fetches an entity by its ID and returns it in serialized format for client components.
 * 
 * @param {string} id - The unique identifier of the entity to fetch.
 * @returns {Promise<SerializedEntity | null>} A promise that resolves to the SerializedEntity object if found, or null if not found.
 * @throws {Error} If the user is not authenticated or lacks the necessary permissions.
 */
export async function getSerializedEntityById(id: string): Promise<SerializedEntity | null> {
  try {
    const entity = await getEntityById(id);
    
    if (!entity) {
      return null;
    }

    // Helper function to safely convert Timestamp to ISO string
    const timestampToISO = (timestamp: any): string => {
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
      }
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      // Fallback to current time if timestamp is invalid
      return new Date().toISOString();
    };

    // Convert Entity to SerializedEntity
    const serializedEntity: SerializedEntity = {
      ...entity,
      dateAdded: timestampToISO(entity.dateAdded),
      lastUpdated: timestampToISO(entity.lastUpdated),
      memberSince: entity.memberSince ? timestampToISO(entity.memberSince) : undefined,
    };

    console.log('Services: getSerializedEntityById - Entity serialized successfully');
    return serializedEntity;
  } catch (error) {
    console.error('Services: getSerializedEntityById - Error fetching entity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching serialized entity');
  }
}

/**
 * Example usage of getEntityById function:
 * 
 * async function displayentity-details(entityId: string) {
 *   try {
 *     const entity = await getEntityById(entityId);
 *     if (entity) {
 *       // Display entity details to the user
 *       console.log('Entity details:', entity);
 *     } else {
 *       console.log('Entity not found');
 *     }
 *   } catch (error) {
 *     console.error('Error fetching entity:', error);
 *     // Handle error (e.g., show error message to user)
 *   }
 * }
 */

