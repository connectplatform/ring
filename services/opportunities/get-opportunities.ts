import { getAdminDb } from '@/lib/firebase-admin.server';
import { QuerySnapshot, Query } from 'firebase-admin/firestore';
import { Opportunity } from '@/types';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { getServerAuthSession } from '@/auth';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, OpportunityDatabaseError, logRingError } from '@/lib/errors';

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
export async function getOpportunities(
  limit: number = 20,
  startAfter?: string
): Promise<{ opportunities: Opportunity[]; lastVisible: string | null }> {
  try {
    console.log('Services: getOpportunities - Starting...');

    // Step 1: Authenticate and get user session
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

    console.log(`Services: getOpportunities - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore using the admin SDK and initialize collection with converter
    let adminDb;
    try {
      adminDb = await getAdminDb();
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
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      query = query.where('visibility', 'in', ['public', 'subscriber', userRole]);
    }

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

    // Step 6: Map document snapshots to Opportunity objects
    const opportunities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Get the ID of the last visible document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    console.log('Services: getOpportunities - Total opportunities fetched:', opportunities.length);

    return { opportunities, lastVisible };
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'Services: getOpportunities - Error');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof OpportunityAuthError || 
        error instanceof OpportunityPermissionError ||
        error instanceof OpportunityQueryError ||
        error instanceof OpportunityDatabaseError) {
      throw error;
    }
    
    throw new OpportunityQueryError(
      'Unknown error occurred while fetching opportunities',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'getOpportunities'
      }
    );
  }
}

