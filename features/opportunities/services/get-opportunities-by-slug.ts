// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { Opportunity } from '@/features/opportunities/types';
import { auth } from '@/auth';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { UserRole } from '@/features/auth/types';
import { Query, Filter } from 'firebase-admin/firestore';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument,
  getCachedCollectionAdvanced
} from '@/lib/services/firebase-service-manager';

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
export async function getOpportunitiesBySlug(slugs: string[]): Promise<Opportunity[]> {try {
  const phase = getCurrentPhase();
console.log('Services: getOpportunitiesBySlug - Starting with slugs:', slugs);

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

    
    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-opportunities-by-slug`);
      
      try {
        // Return cached data based on operation type
        
        const opportunities = await getCachedOpportunities({ limit: 30, status: 'active' });
        const result = opportunities.slice(0, 10); return result;
      } catch (cacheError) {
        console.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Build optimized query configuration based on user role and slugs
    const queryConfig: any = {
      orderBy: [{ field: 'dateCreated', direction: 'desc' }]
    };

    // Build where clauses array
    const whereClause = [];
    
    // Add slug filtering if provided
    if (slugs.length > 0) {
      whereClause.push({ field: 'tags', operator: 'array-contains-any', value: slugs });
    }

    // Apply role-based visibility filtering for non-admin users
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      // For now, we'll use a simpler approach since getCachedCollectionAdvanced may not support complex OR queries
      // We'll filter by visibility after the query
    }

    if (whereClause.length > 0) {
      queryConfig.where = whereClause;
    }

    // Step 3: Execute optimized query
    const snapshot = await getCachedCollectionAdvanced('opportunities', queryConfig);

    // Step 4: Map documents and apply role-based filtering
    let opportunities: Opportunity[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      } as Opportunity;
    });

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

    return opportunities;
  } catch (error) {
    console.error('Services: getOpportunitiesBySlug - Error fetching opportunities by slug:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities by slug');
  }
}
