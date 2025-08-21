// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { QuerySnapshot, Query } from 'firebase-admin/firestore';
import { Opportunity, SerializedOpportunity } from '@/features/opportunities/types';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { getServerAuthSession } from '@/auth';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, OpportunityDatabaseError, logRingError } from '@/lib/errors';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

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

    
    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-opportunities`);
      
      try {
        // Return cached data based on operation type
        
        const opportunities = await getCachedOpportunities({ limit: 30, status: 'active' });
        const result = opportunities.slice(0, 10); return { opportunities: result, lastVisible: null };
      } catch (cacheError) {
        console.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    
    // 🚀 BUILD-TIME OPTIMIZATION: Use cached data during static generation
    if (shouldUseMockData() || (shouldUseCache() && phase.isBuildTime)) {
      console.log(`[Service Optimization] Using ${phase.strategy} data for get-opportunities`);
      
      try {
        // Return cached data based on operation type
        
        const opportunities = await getCachedOpportunities({ limit: 30, status: 'active' });
        const result = opportunities.slice(0, 10); return { opportunities: result, lastVisible: null };
      } catch (cacheError) {
        console.warn('[Service Optimization] Cache fallback failed, using live data:', cacheError);
        // Continue to live data below
      }
    }

    // Step 2: Access Firestore using the admin SDK and initialize collection with converter
    // 🚀 OPTIMIZED: Enhanced error handling with service manager
    let adminDb;
    try {
      const serviceManager = getFirebaseServiceManager();
      adminDb = serviceManager.db;
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to initialize database connection',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userRole,
          operation: 'getAdminDb'
        }
      );
    }

    const opportunitiesCol = adminDb.collection('opportunities').withConverter(opportunityConverter);

    // Step 3: Build query based on user role
    let query: Query<Opportunity> = opportunitiesCol;

    // Apply role-based filtering for non-admin users
    // Visitors see only public. Subscribers see public + subscriber. Members see public + subscriber + member.
    if (userRole === UserRole.VISITOR) {
      query = query.where('visibility', 'in', ['public']);
    } else if (userRole === UserRole.SUBSCRIBER) {
      query = query.where('visibility', 'in', ['public', 'subscriber']);
    } else if (userRole === UserRole.MEMBER) {
      query = query.where('visibility', 'in', ['public', 'subscriber', 'member']);
    }
    // ADMIN and CONFIDENTIAL users see all opportunities (no filter applied)

    // Step 4: Handle pagination
    query = query.limit(limit);
    if (startAfter) {
      try {
        const startAfterDoc = await opportunitiesCol.doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
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

    // Step 5: Execute query
    let snapshot: QuerySnapshot<Opportunity>;
    try {
      snapshot = await query.get();
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

    // Step 6: Map document snapshots to Opportunity objects and serialize Timestamps
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
      };
    });

    // Get the ID of the last visible document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    console.log('Services: getOpportunitiesForRole - Total opportunities fetched:', opportunities.length);

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
  console.log('Services: getOpportunities - Starting...');
  const session = await getServerAuthSession();
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

