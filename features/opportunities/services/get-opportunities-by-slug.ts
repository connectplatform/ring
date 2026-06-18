/**
 * Get Opportunities By Slug Service
 * 
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation cached for performance
 */

import { cache } from 'react'
import { Opportunity } from '@/features/opportunities/types'
import { mapDbDocumentToOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { auth } from '@/auth'
import { assertKnownUserRole } from '@/features/auth/user-role'
import { canViewOpportunity } from '@/features/opportunities/lib/opportunity-visibility-filter'
import { db } from '@/lib/database'

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
 * Note: Confidential opportunities are only included in the results for users with confidential or admin roles.
 *       Other users will only see non-confidential opportunities matching the slugs.
 */
export const getOpportunitiesBySlug = cache(async (slugs: string[]): Promise<Opportunity[]> => {
  try {
    console.log('Services: getOpportunitiesBySlug - Starting with slugs:', slugs)

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const userRole = assertKnownUserRole(session.user.role)

    console.log(`Services: getOpportunitiesBySlug - User authenticated with role ${userRole}`);

    // Step 2: Execute query using db().queryDocs (tags filter in-memory due to array-contains-any)
    const result = await db().queryDocs({
      collection: 'opportunities',
      orderBy: [{ field: 'dateCreated', direction: 'desc' }],
      pagination: { limit: 200 } // Fetch more for filtering
    })

    // Step 3: Map results and apply slug + role-based filtering
    let opportunities: Opportunity[] = []
    if (result.success && result.data) {
      opportunities = result.data.map((item) => mapDbDocumentToOpportunity(item))
      
      // Filter by slugs (array-contains-any equivalent)
      if (slugs.length > 0) {
        opportunities = opportunities.filter(opp => 
          opp.tags && opp.tags.some(tag => slugs.includes(tag))
        )
      }
    }

      opportunities = opportunities.filter((opportunity) =>
        canViewOpportunity(opportunity, { userRole, userId: session.user.id }),
      )

    console.log('Services: getOpportunitiesBySlug - Fetched opportunities:', opportunities.length);

    return opportunities
  } catch (error) {
    console.error('getOpportunitiesBySlug: Error fetching opportunities by slug:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities by slug')
  }
});
