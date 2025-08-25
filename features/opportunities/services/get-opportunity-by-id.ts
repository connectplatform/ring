// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { Opportunity } from '@/features/opportunities/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument,
  getCachedCollectionAdvanced
} from '@/lib/services/firebase-service-manager';
import { logger } from '@/lib/logger';

/**
 * Fetches a single Opportunity from Firestore by its ID, ensuring proper authentication and authorization.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and gets their role.
 * 2. Accesses Firestore using the admin SDK and retrieves the opportunity document.
 * 3. Checks user permissions for viewing the opportunity, especially for confidential opportunities.
 * 4. Returns the opportunity if all checks pass.
 * 
 * User steps:
 * 1. User requests to view a specific opportunity.
 * 2. System checks user's authentication status.
 * 3. If authenticated, system fetches the opportunity data.
 * 4. System verifies user's permission to view the opportunity.
 * 5. If permitted, user receives the opportunity details.
 * 
 * @param {string} id - The ID of the Opportunity to fetch.
 * @returns {Promise<Opportunity | null>} A promise that resolves to the Opportunity object if found, or null if not found.
 * @throws {Error} If the user is not authenticated, lacks necessary permissions, or if an unexpected error occurs.
 * 
 * Note: Only CONFIDENTIAL or ADMIN users can view confidential opportunities.
 */
export async function getOpportunityById(id: string): Promise<Opportunity | null> {try {
  const phase = getCurrentPhase();

console.log('Services: getOpportunityById - Starting...', { id });

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      logger.error('Services: getOpportunityById - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;

    console.log(`Services: getOpportunityById - User authenticated with role ${userRole}`);

    
    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-opportunity-by-id`);
      
      try {
        // Return cached data based on operation type
        
        // Generic cache fallback for build time
        return null;
      } catch (cacheError) {
        logger.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Access Firestore using optimized firebase-service-manager
    const docSnap = await getCachedDocument('opportunities', id);

    if (!docSnap || !docSnap.exists) {
      logger.warn('Services: getOpportunityById - No opportunity found', { id });
      return null;
    }

    const opportunityData = docSnap.data();
    if (!opportunityData) {
      logger.warn('Services: getOpportunityById - Document exists but has no data', { id });
      return null;
    }

    const opportunity: Opportunity = {
      ...opportunityData,
      id: docSnap.id,
    } as Opportunity;

    // Step 3: Check user permissions
    if (opportunity.isConfidential && userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      logger.error('Services: getOpportunityById - Access denied for confidential opportunity', { id, userRole });
      throw new Error('Access denied. You do not have permission to view this confidential opportunity.');
    }

    console.log('Services: getOpportunityById - Opportunity fetched successfully', { id });
    return opportunity;

  } catch (error) {
      logger.error('Services: getOpportunityById - Error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching the opportunity');
  }
}

