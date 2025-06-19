import { getAdminDb } from '@/lib/firebase-admin.server';
import { Opportunity } from '@/types';
import { auth } from '@/auth';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { UserRole } from '@/features/auth/types';
import { Query, Filter } from 'firebase-admin/firestore';

/**
 * Fetches opportunities by matching tags in the 'slug' array, enforcing role-based access control.
 * 
 * @param {string[]} slugs - An array of slug strings to match against opportunity tags.
 * @returns {Promise<Opportunity[]>} A promise that resolves to an array of Opportunity objects matching the given slugs.
 * @throws {Error} If the user is not authenticated or an error occurs during the fetch operation.
 * 
 * User steps:
 * 1. User requests opportunities based on specific slugs (tags).
 * 2. The function authenticates the user and checks their role.
 * 3. The function queries the database for matching opportunities.
 * 4. The function filters the results based on the user's role and permissions.
 * 5. The function returns the filtered list of opportunities to the user.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role for access control.
 * 3. Queries Firestore for opportunities with tags matching the provided slugs.
 * 4. Applies role-based filtering to ensure users only see opportunities they have permission to access.
 * 5. Returns an array of opportunities that match the criteria and the user has permission to view.
 * 
 * Note: Confidential opportunities are only included in the results for users with CONFIDENTIAL or ADMIN roles.
 *       Other users will only see non-confidential opportunities matching the slugs.
 */
export async function getOpportunitiesBySlug(slugs: string[]): Promise<Opportunity[]> {
  try {
    console.log('Services: getOpportunitiesBySlug - Starting with slugs:', slugs);

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;

    console.log(`Services: getOpportunitiesBySlug - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore and initialize collection with converter
    const adminDb = await getAdminDb();
    const opportunitiesCollection = adminDb.collection('opportunities').withConverter(opportunityConverter);

    // Step 3: Build the query based on slugs and user role
    let query: Query<Opportunity> = opportunitiesCollection;

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

    // Step 5: Execute the query
    const snapshot = await query.get();

    // Step 6: Map and return opportunities
    const opportunities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    console.log('Services: getOpportunitiesBySlug - Fetched opportunities:', opportunities.length);

    return opportunities;
  } catch (error) {
    console.error('Services: getOpportunitiesBySlug - Error fetching opportunities by slug:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities by slug');
  }
}
