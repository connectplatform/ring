/**
 * Get Opportunities By Slug Service
 * 
 * Uses: Ring-native DatabaseService + React 19 cache()
 * - READ operation is cached for performance using React's cache().
 * - Service fetches opportunities by matching tags in the 'slug' array,
 *   runs access checks, serializes opportunity data, and manages errors
 *   (compatible with React Server Components).
 * 
 * // TODO: Evaluate using Next 16/React 19 server functions/app router for further caching/data-fetching benefits.
 * // TODO: If supporting Suspense, consider error boundaries for async error handling.
 */

import { cache } from 'react'
import { Opportunity } from '@/features/opportunities/types'
import { mapDbDocumentToOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import { auth } from '@/auth'
import { UserRolesArray, assertKnownUserRole } from '@/features/auth/user-role'
import { canViewOpportunity } from '@/features/opportunities/lib/opportunity-visibility-filter'
import { db } from '@/lib/database'

/**
 * Fetches opportunities by matching tags in the 'slug' array, enforcing role-based access control.
 * @param {string[]} slugs - Array of slug strings to match against opportunity tags.
 * @returns {Promise<Opportunity[]>} - Promise resolving to array of matching Opportunity objects.
 * @throws {Error} If the user is not authenticated or an error occurs during fetch.
 * 
 * Process steps:
 *   1. Authenticate user and retrieve session
 *   2. Check user's role for access
 *   3. Query jobs from the database (all, since tags filter is in-memory)
 *   4. Map DB data to Opportunity type
 *   5. Filter by slug/tags 
 *   6. Filter by access (role-based & canViewOpportunity)
 *   7. Return only permitted results
 * 
 * Note: Confidential opportunities only included for admin/confidential roles.
 */
export const getOpportunitiesBySlug = cache(async (slugs: string[]): Promise<Opportunity[]> => {
  try {
    // Log start with input for debugging
    console.log('Services: getOpportunitiesBySlug - Starting with slugs:', slugs)

    // Step 1: Authenticate and get user session via Auth.js v5
    // TODO: Consider refactoring to server action (/src/app/ api route) for Next 16 support if beneficial
    const session = await auth();
    if (!session || !session.user) {
      // Invalidate/throw if no user found in session
      throw new Error('Unauthorized access');
    }

    // Step 2: Parse/assert user role
    // This ensures we only use valid user roles; will throw if unknown
    const userRole = assertKnownUserRole(session.user.role) as UserRolesArray

    console.log(`Services: getOpportunitiesBySlug - User authenticated with role ${userRole}`);

    // Step 3: Query the opportunities collection from DB
    // NOTE: Because Firestore (and some generic DBs) can't multi-field-filter arrays,
    //       we fetch bulk here and filter in-memory for slugs (tags).
    //       TODO: If using a DB that supports array-contains-any, move filter into query.
    // MOCK CODE, TODO: Replace with direct query once DB supports proper array-contains-any for tags
    const result = await db().queryDocs({
      collection: 'opportunities',
      orderBy: [{ field: 'dateCreated', direction: 'desc' }],
      pagination: { limit: 200 } // TODO: Tune max, support for pagination (currently fixed for simplicity)
    })

    // Step 4: Map DB documents to Opportunity type
    let opportunities: Opportunity[] = []
    if (result.success && result.data) {
      // Transform raw documents to Opportunity structure
      opportunities = result.data.map((item) => mapDbDocumentToOpportunity(item))
      
      // Step 5: Filter by slugs (equivalent to Firestore's array-contains-any in-memory)
      // Only apply slug filter if slugs were provided (not empty)
      if (slugs.length > 0) {
        opportunities = opportunities.filter(opp => 
          opp.tags && opp.tags.some(tag => slugs.includes(tag))
        )
      }
    }

    // Step 6: Filter results again using business access logic (role, confidential, etc)
    // Ensures users only see opportunities they're allowed to view
    opportunities = opportunities.filter((opportunity) =>
      canViewOpportunity(opportunity, { userRole, userId: session.user.id }),
    )

    // Log how many results after all filtering
    console.log('Services: getOpportunitiesBySlug - Fetched opportunities:', opportunities.length);

    // Step 7: Return filtered/safe opportunities
    return opportunities
  } catch (error) {
    // TODO: Switch to React 19/Next 16 error boundary compatible error strategy if doing server actions/data hooks
    console.error('getOpportunitiesBySlug: Error fetching opportunities by slug:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities by slug')
  }
});
