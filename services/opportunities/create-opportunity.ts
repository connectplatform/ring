import { getAdminDb } from '@/lib/firebase-admin.server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Opportunity } from '@/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';

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
 * @throws {Error} If the user is not authenticated, lacks necessary permissions, or if opportunity creation fails.
 */
export async function createOpportunity(data: NewOpportunityData): Promise<Opportunity> {
  try {
    console.log('Services: createOpportunity - Starting opportunity creation process...');

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: createOpportunity - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Validate user permissions
    if (![UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN].includes(userRole as UserRole)) {
      throw new Error('Insufficient permissions to create an opportunity');
    }

    // Step 3: Process opportunity creation
    const createdOpportunity = await processOpportunityCreation(userId, userRole as UserRole, data);

    console.log('Services: createOpportunity - Opportunity created with ID:', createdOpportunity.id);

    return createdOpportunity;
  } catch (error) {
    console.error('Services: createOpportunity - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while creating opportunity');
  }
}

/**
 * Processes the creation of an opportunity in Firestore.
 * 
 * This function performs the following steps:
 * 1. Validates the associated Entity.
 * 2. Checks confidentiality rules.
 * 3. Creates the new opportunity document in Firestore.
 * 4. Retrieves and returns the created opportunity.
 * 
 * @param {string} userId - The ID of the user creating the opportunity.
 * @param {UserRole} userRole - The role of the user creating the opportunity.
 * @param {NewOpportunityData} data - The data for the new opportunity.
 * @returns {Promise<Opportunity>} A promise that resolves to the created Opportunity object.
 * @throws {Error} If entity validation fails or opportunity creation fails.
 */
async function processOpportunityCreation(userId: string, userRole: UserRole, data: NewOpportunityData): Promise<Opportunity> {
  const adminDb = await getAdminDb();
  const opportunitiesCollection = adminDb.collection('opportunities');
  const entitiesCollection = adminDb.collection('entities');

  // Step 1: Validate the associated Entity
  const entityDoc = await entitiesCollection.doc(data.organizationId).get();
  if (!entityDoc.exists) {
    throw new Error(`Entity with ID ${data.organizationId} not found.`);
  }

  const entity = entityDoc.data();
  const isEntityConfidential = entity?.isConfidential || false;
  const entityAddedBy = entity?.contactAccount;

  // Step 2: Check confidentiality rules
  if (data.isConfidential) {
    if (!isEntityConfidential || (entityAddedBy !== UserRole.CONFIDENTIAL && entityAddedBy !== UserRole.ADMIN)) {
      throw new Error('Confidential opportunities must be linked to confidential entities created by ADMIN or CONFIDENTIAL users.');
    }
  }

  // Step 3: Create the new opportunity document
  const newOpportunityData = {
    ...data,
    createdBy: userId,
    dateCreated: FieldValue.serverTimestamp(),
    dateUpdated: FieldValue.serverTimestamp(),
  };

  const docRef = await opportunitiesCollection.add(newOpportunityData);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new Error('Failed to create opportunity');
  }

  // Step 4: Retrieve and return the created opportunity
  const opportunityData = {
    ...docSnap.data(),
    id: docSnap.id,
    dateCreated: docSnap.createTime || Timestamp.now(),
    dateUpdated: docSnap.updateTime || Timestamp.now(),
  };

  return opportunityConverter.fromFirestore({
    ...docSnap,
    data: () => opportunityData,
  } as any);
}

