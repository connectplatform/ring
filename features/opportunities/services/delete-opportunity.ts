/**
 * Delete Opportunity Service
 * 
 * Server-side mutation (NO cache() - mutations must always execute)
 * DatabaseService for persistence + Tunnel for real-time updates
 */

import { db } from '@/lib/database'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { Opportunity } from '@/features/opportunities/types'
import { OpportunityAuthError, OpportunityPermissionError, OpportunityQueryError, OpportunityDatabaseError, logRingError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { canOwnerDeleteOpportunity } from '@/features/opportunities/lib/lifecycle-status'
import { syncOpportunityDiscovery } from '@/features/opportunities/lib/opportunity-mutation-sync'

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

    // Step 2: Get the opportunity using db.command()
    let opportunity;
    try {
      const result = await db().findDocById<Opportunity & { id: string }>('opportunities', id)

      if (!result.success || !result.data) {
        throw new OpportunityQueryError(`Opportunity with ID ${id} not found`, undefined, {
          timestamp: Date.now(),
          opportunityId: id,
          operation: 'document_retrieval'
        });
      }

      opportunity = result.data
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

    // Step 3: Ownership check
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

    // Step 4: Owners may delete only archived listings (admins may delete any)
    if (
      currentUserRole !== UserRole.ADMIN &&
      opportunity.createdBy === currentUserId &&
      !canOwnerDeleteOpportunity(opportunity.status)
    ) {
      throw new OpportunityPermissionError(
        'Only archived opportunities can be deleted. Archive the listing first.',
        undefined,
        {
          timestamp: Date.now(),
          userId: currentUserId,
          opportunityId: id,
          status: opportunity.status,
          operation: 'archived_delete_guard',
        },
      )
    }

    // Step 5: If the opportunity is confidential, ensure the user has appropriate permissions
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

    // Step 5: Delete the opportunity using db.command()
    try {
      const deleteResult = await db().deleteDoc('opportunities', id)

      if (!deleteResult.success) {
        throw new Error(deleteResult.error?.message || 'Failed to delete opportunity');
      }

      logger.info(`Services: deleteOpportunity - Opportunity ${id} deleted successfully`);
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to delete opportunity',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          opportunityId: id,
          operation: 'deletion'
        }
      );
    }

    // Step 6: Discovery sync (cache tags + revalidatePath + Tunnel — PG row delete is the index)
    await syncOpportunityDiscovery({ opportunityId: id, event: 'deleted' })

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
