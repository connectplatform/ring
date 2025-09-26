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
import { db } from '@/lib/database/DatabaseService';


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
  params: {
    userRole: UserRole;
    limit?: number;
    startAfter?: string;
    query?: string;
    types?: string[];
    categories?: string[];
    location?: string;
    budgetMin?: number;
    budgetMax?: number;
    priority?: 'urgent' | 'normal' | 'low';
    deadline?: 'today' | 'week' | 'month';
    entityVerified?: boolean;
    hasDeadline?: boolean;
  }
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> {
  const phase = getCurrentPhase();
  const {
    userRole,
    limit = 20,
    startAfter,
    query,
    types,
    categories,
    location,
    budgetMin,
    budgetMax,
    priority,
    deadline,
    entityVerified,
    hasDeadline
  } = params;
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
    const whereConditions: any[] = [];
    if (userRole === UserRole.VISITOR) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public'] });
    } else if (userRole === UserRole.SUBSCRIBER) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public', 'subscriber'] });
    } else if (userRole === UserRole.MEMBER) {
      whereConditions.push({ field: 'visibility', operator: 'in', value: ['public', 'subscriber', 'member'] });
    }
    // ADMIN and CONFIDENTIAL users see all opportunities (no filter applied)

    // Apply search and filter conditions
    if (query) {
      whereConditions.push({ field: 'title', operator: '>=', value: query });
      whereConditions.push({ field: 'title', operator: '<=', value: query + '\uf8ff' });
    }

    if (types && types.length > 0) {
      whereConditions.push({ field: 'type', operator: 'in', value: types });
    }

    if (categories && categories.length > 0) {
      whereConditions.push({ field: 'category', operator: 'in', value: categories });
    }

    if (location) {
      whereConditions.push({ field: 'location', operator: '>=', value: location });
      whereConditions.push({ field: 'location', operator: '<=', value: location + '\uf8ff' });
    }

    if (budgetMin !== undefined) {
      whereConditions.push({ field: 'budget.amount', operator: '>=', value: budgetMin });
    }

    if (budgetMax !== undefined) {
      whereConditions.push({ field: 'budget.amount', operator: '<=', value: budgetMax });
    }

    if (priority) {
      whereConditions.push({ field: 'priority', operator: '==', value: priority });
    }

    if (deadline) {
      const now = new Date();
      let deadlineDate: Date;

      switch (deadline) {
        case 'today':
          deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'week':
          deadlineDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          deadlineDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        default:
          deadlineDate = now;
      }

      whereConditions.push({ field: 'deadline', operator: '<=', value: deadlineDate });
    }

    if (entityVerified !== undefined) {
      whereConditions.push({ field: 'entity.verified', operator: '==', value: entityVerified });
    }

    if (hasDeadline !== undefined) {
      if (hasDeadline) {
        whereConditions.push({ field: 'deadline', operator: '!=', value: null });
      } else {
        whereConditions.push({ field: 'deadline', operator: '==', value: null });
      }
    }

    if (whereConditions.length > 0) {
      queryConfig.where = whereConditions;
    }

    // Apply pagination if provided
    if (startAfter) {
      try {
        const result = await db().execute('findById', {
          collection: 'opportunities',
          id: startAfter
        });

        if (result.success && result.data) {
          queryConfig.startAfter = result.data;
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

    // Step 3: Execute query using db.command()
    let queryResult;
    try {
      const dbQuery = {
        collection: 'opportunities',
        filters: queryConfig.where || [],
        orderBy: queryConfig.orderBy || [{ field: 'dateCreated', direction: 'desc' }],
        pagination: {
          limit: queryConfig.limit || 20,
          offset: startAfter ? 1 : 0 // Simple offset for pagination
        }
      };

      queryResult = await db().execute('query', { querySpec: dbQuery });
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

    // Step 4: Map query results to SerializedOpportunity objects
    const opportunities: SerializedOpportunity[] = [];
    if (queryResult.success && queryResult.data) {
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

      queryResult.data.forEach(item => {
        const data = item.data;
        opportunities.push({
          ...data,
          id: item.id,
          // Convert Firestore Timestamps to ISO strings for client component serialization
          dateCreated: timestampToISO(data.dateCreated),
          dateUpdated: timestampToISO(data.dateUpdated),
          expirationDate: timestampToISO(data.expirationDate),
          // Handle optional applicationDeadline field
          applicationDeadline: data.applicationDeadline ? timestampToISO(data.applicationDeadline) : undefined,
        } as SerializedOpportunity);
      });
    }

    // Get the ID of the last visible document for pagination
    const lastVisible = opportunities.length > 0 ? opportunities[opportunities.length - 1].id : null;

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

