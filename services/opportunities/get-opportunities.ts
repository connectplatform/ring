import { getAdminDb } from '@/lib/firebase-admin.server';
import { QuerySnapshot, Query } from 'firebase-admin/firestore';
import { Opportunity } from '@/types';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { getServerAuthSession } from '@/auth';

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
 * @throws {Error} If the user is not authenticated or if there's an issue fetching the opportunities
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
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;

    console.log(`Services: getOpportunities - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore using the admin SDK and initialize collection with converter
    const adminDb = await getAdminDb();
    const opportunitiesCol = adminDb.collection('opportunities').withConverter(opportunityConverter);

    // Step 3: Build the query based on user role and apply filters
    // Use a simpler approach to avoid complex composite indexes
    let query: Query<Opportunity>;

    if (userRole === UserRole.ADMIN || userRole === UserRole.CONFIDENTIAL) {
      // Admins and confidential users can see all opportunities
      query = opportunitiesCol.orderBy('dateCreated', 'desc').limit(limit);
    } else {
      // For other users, fetch public opportunities first (this is the most common case)
      // We'll use a simple query that doesn't require complex indexes
      query = opportunitiesCol
        .where('visibility', '==', 'public')
        .orderBy('dateCreated', 'desc')
        .limit(limit);
    }

    // Step 4: Handle pagination using `startAfter`
    if (startAfter) {
      const startAfterDoc = await opportunitiesCol.doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      } else {
        console.log(`Services: getOpportunities - Start-after document ${startAfter} does not exist`);
      }
    }

    // Step 5: Execute the query and process results
    const querySnapshot: QuerySnapshot<Opportunity> = await query.get();

    // Step 6: Map document snapshots to Opportunity objects and apply additional filtering if needed
    let opportunities = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // For non-admin users, we need to filter in memory to include subscriber and role-specific opportunities
    // This is a trade-off to avoid complex indexes while still providing role-based access
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      // For now, we'll only show public opportunities to avoid the index issue
      // TODO: Implement a more sophisticated approach for subscriber and role-specific opportunities
      opportunities = opportunities.filter(op => 
        op.visibility === 'public' || 
        op.visibility === 'subscriber' || 
        op.visibility === userRole
      );
    }

    // Step 7: Get the ID of the last visible document for pagination
    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1].id : null;

    console.log(`Services: getOpportunities - Retrieved ${opportunities.length} opportunities`);
    return { opportunities, lastVisible };
  } catch (error) {
    console.error('Services: getOpportunities - Error fetching opportunities:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching opportunities');
  }
}

