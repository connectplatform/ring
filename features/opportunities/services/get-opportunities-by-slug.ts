/**
 * Get Opportunities By Slug Service
 * 
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation cached for performance
 */

import { cache } from 'react'
import { Opportunity } from '@/features/opportunities/types'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { db } from '@/lib/database/DatabaseService'

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
export const getOpportunitiesBySlug = cache(async (slugs: string[]): Promise<Opportunity[]> => {
  try {
    console.log('Services: getOpportunitiesBySlug - Starting with slugs:', slugs)

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
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

    console.log(`Services: getOpportunitiesBySlug - User authenticated with role ${userRole}`);

    // Step 2: Execute query using DatabaseService (tags filter in-memory due to array-contains-any)
    const result = await db().execute('query', {
      querySpec: {
        collection: 'opportunities',
        orderBy: [{ field: 'dateCreated', direction: 'desc' }],
        pagination: { limit: 200 } // Fetch more for filtering
      }
    })

    // Step 3: Map results and apply slug + role-based filtering
    let opportunities: Opportunity[] = []
    if (result.success && result.data) {
      const items = Array.isArray(result.data) ? result.data : (result.data as any).data || []
      opportunities = items.map((item: any) => {
        const data = item.data || item
        return {
          ...data,
          id: item.id
        } as Opportunity
      })
      
      // Filter by slugs (array-contains-any equivalent)
      if (slugs.length > 0) {
        opportunities = opportunities.filter(opp => 
          opp.tags && opp.tags.some(tag => slugs.includes(tag))
        )
      }
    }

    // Apply role-based visibility filtering for non-admin users
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      const allowedVisibilities = ['public'];
      
      if (userRole === UserRole.SUBSCRIBER || userRole === UserRole.MEMBER) {
        allowedVisibilities.push('subscriber');
      }
      if (userRole === UserRole.MEMBER) {
        allowedVisibilities.push('member');
      }

      opportunities = opportunities.filter(opportunity => 
        allowedVisibilities.includes(opportunity.visibility || 'public')
      );
    }

    console.log('Services: getOpportunitiesBySlug - Fetched opportunities:', opportunities.length);

    return opportunities
  } catch (error) {
    console.error('getOpportunitiesBySlug: Error fetching opportunities by slug:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities by slug')
  }
});
