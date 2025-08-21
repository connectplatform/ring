import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { getServerAuthSession } from '@/auth'; // Consistent session handling
import { entityConverter } from '@/lib/converters/entity-converter';
import { UserRole } from '@/features/auth/types';
import { Query, Filter } from 'firebase-admin/firestore';

/**
 * Fetches entities by matching tags in the 'slug' array, enforcing role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role for access control.
 * 3. Queries Firestore for entities with tags matching the provided slugs.
 * 4. Applies role-based filtering to ensure users only see entities they have permission to access.
 * 5. Returns an array of entities that match the criteria and the user has permission to view.
 * 
 * User steps:
 * 1. User initiates a request to fetch entities by slug (e.g., from a search or filter function).
 * 2. The function authenticates the user and determines their role.
 * 3. The function queries the database for matching entities.
 * 4. The function filters the results based on the user's role and entity visibility.
 * 5. The filtered list of entities is returned to the user.
 * 
 * @param {string[]} slugs - An array of slug strings to match against entity tags.
 * @returns {Promise<Entity[]>} A promise that resolves to an array of Entity objects matching the given slugs.
 * @throws {Error} If the user is not authenticated or an error occurs during the fetch operation.
 * 
 * Note: Confidential entities are only included in the results for users with CONFIDENTIAL or ADMIN roles.
 *       Other users will only see non-confidential entities matching the slugs.
 */
export async function getEntitiesBySlug(slugs: string[]): Promise<Entity[]> {
  try {
    console.log('Services: getEntitiesBySlug - Starting with slugs:', slugs);

    // Step 1: Authenticate and get user session
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.error('Services: getEntitiesBySlug - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;

    // Validate role before proceeding
    const validRoles: UserRole[] = [
      UserRole.VISITOR,
      UserRole.SUBSCRIBER,
      UserRole.MEMBER,
      UserRole.ADMIN,
      UserRole.CONFIDENTIAL
    ];
    if (!userRole || !validRoles.includes(userRole)) {
      throw new Error('Invalid or missing user role');
    }

    console.log(`Services: getEntitiesBySlug - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore and initialize collection with converter
    const adminDb = await getAdminDb();
    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter);

    // Step 3: Build the query based on slugs and user role
    let query: Query<Entity> = entitiesCollection;

    if (slugs.length > 0) {
      query = query.where('tags', 'array-contains-any', slugs);
    }

    // Step 4: Apply role-based visibility filtering
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      query = query.where(
        Filter.or(
          Filter.where('visibility', '==', 'public'),
          Filter.where('visibility', '==', 'subscriber'),
          Filter.where('visibility', '==', userRole)
        )
      );
    }

    console.log('Services: getEntitiesBySlug - Executing Firestore query');

    // Step 5: Execute the query
    const snapshot = await query.get();

    // Step 6: Map and return entities
    const entities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    console.log(`Services: getEntitiesBySlug - Fetched ${entities.length} entities`);

    return entities;
  } catch (error) {
    console.error('Services: getEntitiesBySlug - Error fetching entities by slug:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Unknown error occurred while fetching entities by slug');
  }
}
