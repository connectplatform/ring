/**
 * Get Opportunities Service
 * 
 * Ring-native: DatabaseService + React 19 cache()
 * READ operation - cached for performance
 * 
 * // TODO: Leverage Next.js 16 route cache APIs for optimal ISR/SSR integration
 * // TODO: Explore moving this logic directly to a server action if only used server-side
 */

import { cache } from 'react'; // React 19 cache() for deduplication/memoization
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types';
import {
  mapDbDocumentToSerializedOpportunity,
} from '@/features/opportunities/lib/opportunity-db-mapper'; // Map DB docs to API shape
import { UserRolesArray, assertKnownUserRole } from '@/features/auth/user-role';
import { buildOpportunityVisibilityFilters } from '@/features/opportunities/lib/opportunity-visibility-filter';
import { auth } from '@/auth';
import {
  OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError,
  OpportunityDatabaseError, logRingError
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db } from '@/lib/database'; // Upgrade to edge-optimized database client when possible
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination';

/**
 * Fetches a paginated list of opportunities based on user role and query params.
 *
 * @param {object} params
 * @param {UserRolesArray} params.userRole   - The user's assigned role, must be validated.
 * @param {number} [params.limit=20]        - Max number of docs to fetch.
 * @param {string} [params.startAfter]      - Pagination cursor for next page (doc ID).
 * @param {string} [params.query]           - Query string for text search on title.
 * @param {string[]} [params.types]         - Filter by opportunity types.
 * @param {string[]} [params.categories]    - Filter by opportunity categories.
 * @param {string}   [params.location]      - Filter by location (prefix match).
 * @param {number}   [params.budgetMin]     - Minimum budget filter.
 * @param {number}   [params.budgetMax]     - Maximum budget filter.
 * @param {'urgent'|'normal'|'low'} [params.priority] - Priority filter.
 * @param {'today'|'week'|'month'} [params.deadline]  - Deadline filter (relative).
 * @param {boolean}  [params.entityVerified]- Only show verified entities if true.
 * @param {boolean}  [params.hasDeadline]   - Filter for has/not has deadline.
 * @returns {Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }>}
 */
export const getOpportunitiesForRole = cache(async (
  params: {
    userRole: UserRolesArray;
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
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  // Destructure with defaults for safety
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
    // Log start of function for trace/debug
    // TODO: Remove console log in production; rely on logger.info
    console.log('Services: getOpportunitiesForRole - Starting...', { userRole, limit, startAfter });

    // Validate the user role input to prevent any privilege escalation or unknown role bugs
    assertKnownUserRole(userRole) as UserRolesArray;

    // Step 1: Build DB query config with default sorting and limit
    const queryConfig: {
      limit: number,
      orderBy: { field: string, direction: 'desc' | 'asc' }[],
      where?: any[]
    } = {
      limit,
      orderBy: [{ field: 'dateCreated', direction: 'desc' }]
    };

    // Step 2: Assemble filters from user role and supplied params
    // Role determines global document visibility scope
    const whereConditions: any[] = [...buildOpportunityVisibilityFilters(userRole)];

    // ---------- Dynamic filtering logic for search and filters ----------
    // Full-text prefix search on title (best effort, not ranked)
    if (query) {
      whereConditions.push({ field: 'title', operator: '>=', value: query });
      whereConditions.push({ field: 'title', operator: '<=', value: query + '\uf8ff' });
    }

    // Type/category filtering if specified
    if (types && types.length > 0) {
      whereConditions.push({ field: 'type', operator: 'in', value: types });
    }

    if (categories && categories.length > 0) {
      whereConditions.push({ field: 'category', operator: 'in', value: categories });
    }

    // Location prefix match (not geo/coordinate)
    if (location) {
      const loc = location.toLowerCase();
      whereConditions.push({ field: 'location', operator: '>=', value: loc });
      whereConditions.push({ field: 'location', operator: '<=', value: loc + '\uf8ff' });
    }

    // Numeric budget filters
    if (budgetMin !== undefined) {
      whereConditions.push({ field: 'budget.amount', operator: '>=', value: budgetMin });
    }
    if (budgetMax !== undefined) {
      whereConditions.push({ field: 'budget.amount', operator: '<=', value: budgetMax });
    }

    // Priority (enum: urgent, normal, low)
    if (priority) {
      whereConditions.push({ field: 'priority', operator: '=', value: priority });
    }

    // Deadline relative queries (today, week, month)
    if (deadline) {
      const now = new Date();
      let deadlineDate: Date;
      switch (deadline) {
        case 'today':
          deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // midnight next day
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

    // Filter for only verified entities (or not)
    if (entityVerified !== undefined) {
      whereConditions.push({ field: 'entity.verified', operator: '=', value: entityVerified });
    }

    // Filter by deadline existence
    if (hasDeadline !== undefined) {
      if (hasDeadline) {
        whereConditions.push({ field: 'deadline', operator: '!=', value: null });
      } else {
        whereConditions.push({ field: 'deadline', operator: '=', value: null });
      }
    }

    // Only attach .where property if filters present, for compatibility with DB drivers
    if (whereConditions.length > 0) {
      queryConfig.where = whereConditions;
    }

    // ------------------ Pagination using ID (cursor) ------------------
    if (startAfter) {
      try {
        // Find doc by ID so we can use its sort field as the next cursor
        // MOCK CODE, TODO: Use Firestore cursor or proper DB cursor API; optimize to fetch only required fields
        const result = await db().findDocById('opportunities', startAfter);

        if (result.success && result.data) {
          // Support for both "dateCreated" and legacy "date_created"
          const cursorDate =
            (result.data as { dateCreated?: string; date_created?: string }).dateCreated ??
            (result.data as { date_created?: string }).date_created;

          if (cursorDate) {
            // Use the date as a sorting pagination cursor
            whereConditions.push({ field: 'dateCreated', operator: '<', value: cursorDate });
          } else {
            // Fallback: prevent duplicate if no date
            whereConditions.push({ field: 'id', operator: '!=', value: startAfter });
          }
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

    // ---------------------- Execute query on DB -----------------------
    let queryResult;
    try {
      // Build query object for driver (abstracted for DB portability)
      const dbQuery = {
        collection: 'opportunities',
        filters: queryConfig.where || [],
        orderBy: queryConfig.orderBy || [{ field: 'dateCreated', direction: 'desc' }],
        pagination: {
          limit: queryConfig.limit || 20,
        }
      };

      // MOCK CODE, TODO: Replace with server actions or Next.js native fetch as DB drivers evolve
      queryResult = await db().queryDocs(dbQuery);
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

    // ----------- Map raw DB docs to strong API type for output --------
    const opportunities: SerializedOpportunity[] = [];
    if (queryResult.success && queryResult.data) {
      for (const item of queryResult.data) {
        // All DB results must be sanitized and converted to API format
        opportunities.push(mapDbDocumentToSerializedOpportunity(item));
      }
    }

    // Compute pagination cursor for response (for infinite scroll UIs)
    const { nextCursor: lastVisible } = computePaginationCursor(
      opportunities,
      limit,
      (item) => item.id,
    );

    // Log the result for observability (do not log all docs!)
    logger.info('Services: getOpportunitiesForRole - Total opportunities fetched:', {
      opportunities: opportunities.length,
      lastVisible
    });

    // Return typed and serialized results, and nextPage cursor if available
    return { opportunities, lastVisible };
  } catch (error) {
    // Centralized catch for error reporting and output wrapping
    logRingError(error, 'Services: getOpportunitiesForRole - Error');

    // If it's a known error, pass through; else, wrap as query error
    if (
      error instanceof OpportunityPermissionError ||
      error instanceof OpportunityQueryError ||
      error instanceof OpportunityDatabaseError
    ) {
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
});

// ---------------------------
// Wrapper for session context
// ---------------------------
// React 19 cache() wrapper for automatic deduplication,
// ensures user session is available. Only use in SSR/server code.
export const getOpportunities = cache(async (
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: SerializedOpportunity[]; lastVisible: string | null }> => {
  logger.info('Services: getOpportunities - Starting...');

  // MOCK CODE, TODO: Replace with native Next.js 16 request context reader
  //                 when fully available for server actions.
  const session = await auth();

  // Authentication guard: Ensure session & user is present
  if (!session || !session.user) {
    throw new OpportunityAuthError('Unauthorized access', undefined, {
      timestamp: Date.now(),
      hasSession: !!session,
      hasUser: !!session?.user,
      operation: 'getOpportunities'
    });
  }

  // Validate and coerce user role before querying
  const userRole = assertKnownUserRole(session.user.role) as UserRolesArray;

  // Invoke main query with validated role
  return getOpportunitiesForRole({ userRole, limit, startAfter });
});