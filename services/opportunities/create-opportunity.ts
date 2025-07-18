import { getAdminDb } from '@/lib/firebase-admin.server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Opportunity } from '@/types';
import { getServerAuthSession } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { OpportunityAuthError, OpportunityPermissionError, OpportunityDatabaseError, OpportunityQueryError, logRingError } from '@/lib/errors';

/**
 * Type definition for the data required to create a new opportunity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewOpportunityData = Omit<Opportunity, 'id' | 'dateCreated' | 'dateUpdated'>;

/**
 * Creates a new Opportunity in Firestore.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Validates the user's role and permissions.
 * 3. Processes the opportunity creation.
 * 4. Returns the created opportunity.
 * 
 * User steps:
 * 1. User must be authenticated before calling this function.
 * 2. User provides the necessary data for creating an opportunity.
 * 3. The function validates the user's permissions and the provided data.
 * 4. If validation passes, the opportunity is created and returned.
 * 
 * @param {NewOpportunityData} data - The data for the new opportunity.
 * @returns {Promise<Opportunity>} A promise that resolves to the created Opportunity object, including its generated ID.
 * @throws {OpportunityAuthError} If user authentication fails
 * @throws {OpportunityPermissionError} If user lacks permission to create opportunities
 * @throws {OpportunityDatabaseError} If database operations fail
 * @throws {OpportunityQueryError} If opportunity creation fails
 */
export async function createOpportunity(data: NewOpportunityData): Promise<Opportunity> {
  try {
    console.log('Services: createOpportunity - Starting opportunity creation process...');

    // Step 1: Authenticate the user
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      throw new OpportunityAuthError('User authentication required to create opportunity', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'createOpportunity'
      });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    // Step 2: Validate user permissions and opportunity data
    if (!userId) {
      throw new OpportunityAuthError('Valid user ID required to create opportunity', undefined, {
        timestamp: Date.now(),
        session: !!session,
        operation: 'createOpportunity'
      });
    }

    // Validate confidential opportunity permissions
    if (data.isConfidential && userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      throw new OpportunityPermissionError(
        'Only ADMIN or CONFIDENTIAL users can create confidential opportunities',
        undefined,
        {
          timestamp: Date.now(),
          userId,
          userRole,
          isConfidential: data.isConfidential,
          requiredRoles: [UserRole.ADMIN, UserRole.CONFIDENTIAL],
          operation: 'createOpportunity'
        }
      );
    }

    // Validate regular opportunity permissions
    if (!data.isConfidential && ![UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL].includes(userRole)) {
      throw new OpportunityPermissionError(
        'Only MEMBER, ADMIN, or CONFIDENTIAL users can create opportunities',
        undefined,
        {
          timestamp: Date.now(),
          userId,
          userRole,
          isConfidential: data.isConfidential,
          requiredRoles: [UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL],
          operation: 'createOpportunity'
        }
      );
    }

    console.log(`Services: createOpportunity - User authenticated: ${userId} with role: ${userRole}`);

    // Step 3: Initialize database connection
    let adminDb;
    try {
      adminDb = await getAdminDb();
    } catch (error) {
      throw new OpportunityDatabaseError(
        'Failed to initialize database connection',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          operation: 'getAdminDb'
        }
      );
    }

    const opportunitiesCollection = adminDb.collection('opportunities').withConverter(opportunityConverter);

    // Step 4: Create the new opportunity document
    const newOpportunityData = {
      ...data,
      createdBy: userId,
      dateCreated: FieldValue.serverTimestamp(),
      dateUpdated: FieldValue.serverTimestamp(),
    };

    let docRef;
    try {
      docRef = await opportunitiesCollection.add(newOpportunityData);
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to create opportunity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityData: newOpportunityData,
          operation: 'opportunity_creation'
        }
      );
    }

    // Step 5: Retrieve the created opportunity
    let docSnap;
    try {
      docSnap = await docRef.get();
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to retrieve created opportunity',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_retrieval'
        }
      );
    }

    if (!docSnap.exists) {
      throw new OpportunityQueryError(
        'Created opportunity document not found',
        undefined,
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_verification'
        }
      );
    }

    // Step 6: Retrieve and return the created opportunity
    const opportunityData = {
      ...docSnap.data(),
      id: docSnap.id,
      dateCreated: docSnap.createTime || Timestamp.now(),
      dateUpdated: docSnap.updateTime || Timestamp.now(),
    };

    let createdOpportunity;
    try {
      createdOpportunity = opportunityConverter.fromFirestore({
        ...docSnap,
        data: () => opportunityData,
      } as any);
    } catch (error) {
      throw new OpportunityQueryError(
        'Failed to convert opportunity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          opportunityId: docRef.id,
          operation: 'opportunity_conversion'
        }
      );
    }

    console.log(`Services: createOpportunity - Opportunity created successfully with ID: ${docRef.id}`);
    return createdOpportunity;

  } catch (error) {
    // Enhanced error logging with cause information
    logRingError(error, 'Services: createOpportunity - Error creating opportunity');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof OpportunityAuthError || 
        error instanceof OpportunityPermissionError ||
        error instanceof OpportunityDatabaseError ||
        error instanceof OpportunityQueryError) {
      throw error;
    }
    
    throw new OpportunityQueryError(
      'Unknown error occurred while creating opportunity',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'createOpportunity'
      }
    );
  }
}

