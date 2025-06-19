import { getAdminDb } from '@/lib/firebase-admin.server';
import { Opportunity } from '@/types';
import { auth } from '@/auth';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { UserRole } from '@/features/auth/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Updates an opportunity by its ID in Firestore, enforcing role-based access control.
 * 
 * @param {string} id - The unique identifier of the opportunity to update.
 * @param {Partial<Opportunity>} data - Partial Opportunity object containing the fields to update.
 * @returns {Promise<boolean>} A promise that resolves to true if the update was successful, false otherwise.
 * @throws {Error} If the user is not authenticated or lacks the necessary permissions.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Retrieves the current opportunity data from Firestore.
 * 3. Checks if the user is either the opportunity creator, an admin, or has the appropriate role for confidential opportunities.
 * 4. Updates the opportunity with the provided data using Firestore's merge functionality.
 * 5. Returns true if the update was successful, false otherwise.
 * 
 * User steps:
 * 1. User attempts to update an opportunity.
 * 2. System checks user's authentication and role.
 * 3. If authorized, system updates the opportunity with provided data.
 * 4. System confirms successful update or returns error if unauthorized.
 * 
 * Note: Only the opportunity creator, users with ADMIN role, or users with appropriate roles for confidential opportunities can update opportunities.
 */
export async function updateOpportunity(id: string, data: Partial<Opportunity>): Promise<boolean> {
  try {
    console.log('Services: updateOpportunity - Starting update for ID:', id);

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: updateOpportunity - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const userRole = session.user.role as UserRole;
    const userId = session.user.id;

    console.log(`Services: updateOpportunity - User authenticated with role ${userRole} and ID ${userId}`);

    // Step 2: Access Firestore and get the current opportunity document
    const adminDb = await getAdminDb();
    const docRef = adminDb.collection('opportunities').doc(id).withConverter(opportunityConverter);
    const docSnap = await docRef.get();

    // Step 3: Check if the opportunity exists
    if (!docSnap.exists) {
      console.warn('Services: updateOpportunity - No opportunity found with ID:', id);
      return false;
    }

    // Step 4: Get the current opportunity data and check permissions
    const currentOpportunity = docSnap.data();
    if (currentOpportunity) {
      if (userRole !== UserRole.ADMIN && userId !== currentOpportunity.createdBy) {
        if (currentOpportunity.isConfidential && userRole !== UserRole.CONFIDENTIAL) {
          console.error('Services: updateOpportunity - Access denied for confidential opportunity');
          throw new Error('Access denied. Only the opportunity creator, an admin, or a confidential user can update this confidential opportunity.');
        }
        if (!currentOpportunity.isConfidential && userRole !== UserRole.MEMBER) {
          console.error('Services: updateOpportunity - Access denied for non-confidential opportunity');
          throw new Error('Access denied. Only the opportunity creator, an admin, or a member can update this opportunity.');
        }
      }

      // Step 5: Prepare the update data
      const updateData = {
        ...data,
        dateUpdated: FieldValue.serverTimestamp(),
      };

      // Step 6: Update the Firestore document
      await docRef.set(updateData, { merge: true });
      console.log('Services: updateOpportunity - Opportunity updated successfully');

      return true; // Indicate successful update
    }

    console.warn('Services: updateOpportunity - Opportunity data is null');
    return false; // Opportunity not found or data is null
  } catch (error) {
    console.error('Services: updateOpportunity - Error updating opportunity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while updating opportunity');
  }
}
