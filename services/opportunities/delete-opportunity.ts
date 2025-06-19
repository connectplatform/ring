import { getAdminDb, getAdminRtdbRef, setAdminRtdbData } from '@/lib/firebase-admin.server';
import { auth } from '@/auth'; // Auth.js v5 handler for session management
import { UserRole } from '@/features/auth/types';
import { Opportunity } from '@/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

/**
 * Deletes an opportunity by its ID from the Firestore collection and removes any associated data from Realtime Database.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Retrieves the opportunity document from Firestore.
 * 3. Checks the user's permission to delete the opportunity.
 * 4. Deletes the opportunity from Firestore.
 * 5. Removes associated data from Realtime Database.
 * 6. Performs any additional cleanup operations.
 * 
 * User steps:
 * 1. User initiates the deletion of an opportunity.
 * 2. The system verifies the user's authentication and authorization.
 * 3. If authorized, the system deletes the opportunity and associated data.
 * 4. The user receives confirmation of successful deletion or an error message.
 * 
 * @param {string} id - The ID of the opportunity to delete.
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the deletion was successful.
 * @throws {Error} If the user is not authenticated, lacks necessary permissions, or if any other error occurs during the deletion process.
 */
export async function deleteOpportunity(id: string): Promise<boolean> {
  console.log('Services: deleteOpportunity - Starting deletion of opportunity:', id);

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: deleteOpportunity - Unauthorized access attempt');
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: deleteOpportunity - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Get the opportunity document
    const adminDb = await getAdminDb();
    const opportunitiesCollection = adminDb.collection('opportunities').withConverter(opportunityConverter);
    const opportunityDoc = await opportunitiesCollection.doc(id).get();

    if (!opportunityDoc.exists) {
      console.warn(`Services: deleteOpportunity - Opportunity with ID ${id} not found.`);
      throw new Error(`Opportunity with ID ${id} not found.`);
    }

    const opportunity = opportunityDoc.data() as Opportunity;

    // Step 3: Check user's permission to delete the opportunity
    if (userRole !== UserRole.ADMIN && opportunity.createdBy !== userId) {
      console.warn(`Services: deleteOpportunity - User ${userId} attempted to delete opportunity ${id} without permission.`);
      throw new Error('You do not have permission to delete this opportunity.');
    }

    // Step 4: If the opportunity is confidential, ensure the user has appropriate permissions
    if (opportunity.isConfidential && userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      console.warn(`Services: deleteOpportunity - User ${userId} attempted to delete confidential opportunity ${id} without permission.`);
      throw new Error('You do not have permission to delete confidential opportunities.');
    }

    // Step 5: Delete the opportunity from Firestore
    await opportunitiesCollection.doc(id).delete();
    console.log(`Services: deleteOpportunity - Opportunity ${id} deleted from Firestore`);

    // Step 6: Remove any associated data from Realtime Database
    await setAdminRtdbData(`opportunities/${id}`, null);
    console.log(`Services: deleteOpportunity - Associated data for opportunity ${id} removed from Realtime Database`);

    // Step 7: Perform any additional cleanup (e.g., deleting associated files, updating indexes, etc.)
    // Add any necessary cleanup operations here
    // For example:
    // await deleteAssociatedFiles(id);
    // await updateOpportunityIndexes(id);

    console.log('Services: deleteOpportunity - Opportunity deleted successfully:', id);
    return true;
  } catch (error) {
    console.error('Services: deleteOpportunity - Error deleting opportunity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while deleting opportunity');
  }
}

/**
 * Helper function to delete associated files (if any)
 * This is a placeholder function and should be implemented based on your specific requirements
 * 
 * @param {string} opportunityId - The ID of the opportunity whose files need to be deleted
 */
async function deleteAssociatedFiles(opportunityId: string): Promise<void> {
  // Implementation for deleting associated files
  console.log(`Deleting associated files for opportunity ${opportunityId}`);
  // Add your implementation here
}

/**
 * Helper function to update opportunity indexes after deletion
 * This is a placeholder function and should be implemented based on your specific requirements
 * 
 * @param {string} deletedOpportunityId - The ID of the deleted opportunity
 */
async function updateOpportunityIndexes(deletedOpportunityId: string): Promise<void> {
  // Implementation for updating indexes after opportunity deletion
  console.log(`Updating indexes after deleting opportunity ${deletedOpportunityId}`);
  // Add your implementation here
}

