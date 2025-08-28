// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminRtdbRef, setAdminRtdbData } from '@/lib/firebase-admin.server';
import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedOpportunities } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument as getCachedFirebaseDocument,
  getCachedCollectionAdvanced,
  deleteDocument
} from '@/lib/services/firebase-service-manager';

import { auth } from '@/auth'; // Auth.js v5 handler for session management
import { UserRole } from '@/features/auth/types';
import { Opportunity } from '@/features/opportunities/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { invalidateOpportunitiesCache } from '@/lib/cached-data';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, OpportunityDatabaseError, logRingError } from '@/lib/errors';
import { logger } from '@/lib/logger';

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
 * @param {string} [userId] - Optional user ID to bypass session lookup
 * @param {UserRole} [userRole] - Optional user role to bypass session lookup
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the deletion was successful.
 * @throws {OpportunityAuthError} If the user is not authenticated
 * @throws {OpportunityPermissionError} If the user lacks necessary permissions
 * @throws {OpportunityDatabaseError} If there's an error accessing the database
 * @throws {OpportunityQueryError} If there's an error executing the deletion
 */
export async function deleteOpportunity(id: string, userId?: string, userRole?: UserRole): Promise<boolean> {
  const phase = getCurrentPhase();
  
  try {
    logger.info('Services: deleteOpportunity - Starting deletion of opportunity:', { id, userId, userRole });

    // Step 1: Authenticate and get user session (if not provided)
    let currentUserId = userId;
    let currentUserRole = userRole;
    
    if (!currentUserId || !currentUserRole) {
      const session = await auth();
      if (!session || !session.user) {
        throw new OpportunityAuthError('Unauthorized access', undefined, {
          timestamp: Date.now(),
          hasSession: !!session,
          hasUser: !!session?.user,
          operation: 'deleteOpportunity'
        });
      }
      currentUserId = session.user.id;
      currentUserRole = session.user.role as UserRole;
    }

    // Validate role
    const validRoles: UserRole[] = [
      UserRole.VISITOR,
      UserRole.SUBSCRIBER,
      UserRole.MEMBER,
      UserRole.ADMIN,
      UserRole.CONFIDENTIAL
    ];

    if (!currentUserRole || !validRoles.includes(currentUserRole)) {
      throw new OpportunityPermissionError('Invalid or missing user role', undefined, {
        timestamp: Date.now(),
        hasRole: !!currentUserRole,
        role: currentUserRole,
        operation: 'role_validation'
      });
    }

    logger.info(`Services: deleteOpportunity - User authenticated with ID ${currentUserId} and role ${currentUserRole}`);

    // Step 2: Get the opportunity document
    // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    let opportunityDoc;
    try {
      opportunityDoc = await getCachedFirebaseDocument('opportunities', id);
      
      if (!opportunityDoc || !opportunityDoc.exists) {
        throw new OpportunityQueryError(`Opportunity with ID ${id} not found`, undefined, {
          timestamp: Date.now(),
          opportunityId: id,
          operation: 'document_retrieval'
        });
      }
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to retrieve opportunity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          opportunityId: id,
          operation: 'document_retrieval'
        }
      );
    }

    const opportunity = opportunityDoc.data() as Opportunity;

    // Step 3: Check user's permission to delete the opportunity
    if (currentUserRole !== UserRole.ADMIN && opportunity.createdBy !== currentUserId) {
      throw new OpportunityPermissionError(
        'You do not have permission to delete this opportunity',
        undefined,
        {
          timestamp: Date.now(),
          userId: currentUserId,
          userRole: currentUserRole,
          opportunityId: id,
          opportunityCreatedBy: opportunity.createdBy,
          operation: 'ownership_check'
        }
      );
    }

    // Step 4: If the opportunity is confidential, ensure the user has appropriate permissions
    if (opportunity.isConfidential && currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.CONFIDENTIAL) {
      throw new OpportunityPermissionError(
        'You do not have permission to delete confidential opportunities',
        undefined,
        {
          timestamp: Date.now(),
          userId: currentUserId,
          userRole: currentUserRole,
          opportunityId: id,
          isConfidential: opportunity.isConfidential,
          operation: 'confidential_check'
        }
      );
    }

    // Step 5: Delete the opportunity from Firestore
    try {
      await deleteDocument('opportunities', id);
      logger.info(`Services: deleteOpportunity - Opportunity ${id} deleted from Firestore`);
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to delete opportunity from Firestore',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          opportunityId: id,
          operation: 'firestore_deletion'
        }
      );
    }

    // Step 6: Remove any associated data from Realtime Database
    try {
      await setAdminRtdbData(`opportunities/${id}`, null);
      logger.info(`Services: deleteOpportunity - Associated data for opportunity ${id} removed from Realtime Database`);
    } catch (error) {
      logger.warn('Services: deleteOpportunity - Failed to remove RTDB data, continuing...', error);
      // Don't throw here as the main deletion succeeded
    }

    // Step 7: Perform cache invalidation
    try {
      invalidateOpportunitiesCache(['public','subscriber','member','confidential','admin']);
    } catch (error) {
      logger.warn('Services: deleteOpportunity - Failed to invalidate cache, continuing...', error);
      // Don't throw here as the main deletion succeeded
    }

    logger.info('Services: deleteOpportunity - Opportunity deleted successfully:', { id });
    return true;
  } catch (error) {
    // Enhanced error logging with cause information using centralized logger
    logRingError(error, 'Services: deleteOpportunity - Error');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof OpportunityAuthError ||
        error instanceof OpportunityPermissionError ||
        error instanceof OpportunityQueryError ||
        error instanceof OpportunityDatabaseError) {
      throw error;
    }
    
    throw new OpportunityQueryError(
      'Unknown error occurred while deleting opportunity',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        opportunityId: id,
        operation: 'deleteOpportunity'
      }
    );
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
  logger.info(`Deleting associated files for opportunity ${opportunityId}`);
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
  logger.info(`Updating indexes after deleting opportunity ${deletedOpportunityId}`);
  // Add your implementation here
}
