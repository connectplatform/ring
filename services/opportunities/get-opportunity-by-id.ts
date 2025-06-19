import { getAdminDb } from '@/lib/firebase-admin.server';
import { Opportunity } from '@/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

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
export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  try {
    console.log('Services: getOpportunityById - Starting...', { id });

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: getOpportunityById - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;

    console.log(`Services: getOpportunityById - User authenticated with role ${userRole}`);

    // Step 2: Access Firestore using admin SDK and get the opportunity document
    const adminDb = getAdminDb();
    const opportunityRef = adminDb.collection('opportunities').doc(id).withConverter(opportunityConverter);
    const docSnap = await opportunityRef.get();

    if (!docSnap.exists) {
      console.warn('Services: getOpportunityById - No opportunity found', { id });
      return null;
    }

    const opportunity = docSnap.data();
    if (!opportunity) {
      console.warn('Services: getOpportunityById - Document exists but has no data', { id });
      return null;
    }

    // Step 3: Check user permissions
    if (opportunity.isConfidential && userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
      console.error('Services: getOpportunityById - Access denied for confidential opportunity', { id, userRole });
      throw new Error('Access denied. You do not have permission to view this confidential opportunity.');
    }

    console.log('Services: getOpportunityById - Opportunity fetched successfully', { id });
    return opportunity;

  } catch (error) {
    console.error('Services: getOpportunityById - Error:', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred while fetching the opportunity');
  }
}

