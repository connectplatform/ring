// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { QuerySnapshot, Query } from 'firebase-admin/firestore';
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types';
import { UserRole } from '@/features/auth/types';
import { auth } from '@/auth'; 
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, OpportunityDatabaseError, logRingError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument,
  getCachedCollectionAdvanced
} from '@/lib/services/firebase-service-manager';


/**
 * Fetches a paginated list of opportunities based on user role.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Accesses Firestore using the admin SDK.
 * 3. Builds a query based on the user's role and applies filters.
 * 4. Handles pagination if a startAfter parameter is provided.
 * 5. Executes the query and processes the results.
 * 6. Returns the opportunities and the ID of the last visible document for pagination.
 * 
 * User steps:
 * 1. User requests a list of opportunities (typically through a frontend API call).
 * 2. The function authenticates the user and determines their role.
 * 3. Based on the user's role, the function fetches appropriate opportunities.
 * 4. The function returns the opportunities to be displayed to the user.
 * 
 * @param {number} limit - The maximum number of opportunities to fetch (default: 20)
 * @param {string} [startAfter] - The ID of the last document from the previous page for pagination
 * @returns {Promise<{ opportunities: Opportunity[]; lastVisible: string | null }>} A promise that resolves to an object containing the opportunities and the ID of the last visible document
 * @throws {OpportunityAuthError} If the user is not authenticated
 * @throws {OpportunityDatabaseError} If there's an error accessing the database
 * @throws {OpportunityQueryError} If there's an error executing the query
 */
export async function getOpportunitiesForRole(
  params: { userRole: UserRole; limit?: number; startAfter?: string }
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  const phase = getCurrentPhase();
  const { userRole, limit = 20, startAfter } = params;
  try {
    console.log('Services: getOpportunitiesForRole - Starting...', { userRole, limit, startAfter });

    // Validate role before proceeding to ensure only authenticated users with valid roles can access opportunities
    const validRoles: UserRole[] = [
      UserRole.VISITOR,
      UserRole.SUBSCRIBER,
      UserRole.MEMBER,
      UserRole.ADMIN,
      UserRole.CONFIDENTIAL
    ];

    if (!userRole || !validRoles.includes(userRole)) {
      throw new OpportunityPermissionError('Invalid or missing user role', undefined, {
        timestamp: Date.now(),
        hasRole: !!userRole,
        role: userRole,
        operation: 'role_validation'
      });
    }

    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data ONLY during actual build phase
    // Skip optimization in development and runtime to ensure real data is always returned
    if (phase.isBuildTime && process.env.NODE_ENV === 'production' && (shouldUseMockData() || shouldUseCache())) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-opportunities (build-time only)`);
      
      try {
        const opportunities = await getCachedOpportunities({ limit: 30, status: 'active' });
        const result = opportunities.slice(0, Math.min(limit, 10));
        return { opportunities: result, lastVisible: null };
      } catch (cacheError) {
        logger.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Build optimized query configuration based on user role
    const queryConfig: any = {
      limit,
      orderBy: [{ field: 'dateCreated', direction: 'desc' }]
    };

    // Apply role-based filtering for non-admin users
    // Visitors see only public. Subscribers see public + subscriber. Members see public + subscriber + member.
    if (userRole === UserRole.VISITOR) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public'] }];
    } else if (userRole === UserRole.SUBSCRIBER) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public', 'subscriber'] }];
    } else if (userRole === UserRole.MEMBER) {
      queryConfig.where = [{ field: 'visibility', operator: 'in', value: ['public', 'subscriber', 'member'] }];
    }
    // ADMIN and CONFIDENTIAL users see all opportunities (no filter applied)

    // Apply pagination if provided
    if (startAfter) {
      try {
        const startAfterDoc = await getCachedDocument('opportunities', startAfter);
        if (startAfterDoc && startAfterDoc.exists) {
          queryConfig.startAfter = startAfterDoc;
        }
      } catch (error) {
        throw new OpportunityQueryError(
          'Failed to apply pagination',
          error instanceof Error ? error : new Error(String(error)),
          {
            timestamp: Date.now(),
            userRole,
            startAfter,
            operation: 'pagination'
          }
        );
      }
    }

    // Step 3: Execute optimized query
    let snapshot;
    try {
      snapshot = await getCachedCollectionAdvanced('opportunities', queryConfig);
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to execute opportunities query',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole,
          limit,
          startAfter,
          operation: 'query_execution'
        }
      );
    }

    // Step 4: Map document snapshots to Opportunity objects and serialize Timestamps
    const opportunities = snapshot.docs.map(doc => {
      const data = doc.data();
      
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
      
      return {
        ...data,
        id: doc.id,
        // Convert Firestore Timestamps to ISO strings for client component serialization
        dateCreated: timestampToISO(data.dateCreated),
        dateUpdated: timestampToISO(data.dateUpdated),
        expirationDate: timestampToISO(data.expirationDate),
        // Handle optional applicationDeadline field
        applicationDeadline: data.applicationDeadline ? timestampToISO(data.applicationDeadline) : undefined,
      };
    });

    // Get the ID of the last visible document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    logger.info('Services: getOpportunitiesForRole - Total opportunities fetched:', { opportunities: opportunities.length, lastVisible } );

    return { opportunities, lastVisible };
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'Services: getOpportunitiesForRole - Error');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof OpportunityPermissionError ||
        error instanceof OpportunityQueryError ||
        error instanceof OpportunityDatabaseError) {
      throw error;
    }
    
    throw new OpportunityQueryError(
      'Unknown error occurred while fetching opportunities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getOpportunitiesForRole'
      }
    );
  }
}

// Convenience wrapper for contexts where dynamic session access is allowed (not inside caches)
export async function getOpportunities(
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  logger.info('Services: getOpportunities - Starting...');
  const session = await auth();
  if (!session || !session.user) {
    throw new OpportunityAuthError('Unauthorized access', undefined, {
      timestamp: Date.now(),
      hasSession: !!session,
      hasUser: !!session?.user,
      operation: 'getOpportunities'
    });
  }
  const userRole = session.user.role as UserRole;
  return getOpportunitiesForRole({ userRole, limit, startAfter });
}

