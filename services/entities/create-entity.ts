import { getAdminDb, getAdminRtdb, getAdminRtdbRef, setAdminRtdbData, setAdminRtdbOnDisconnect, getAdminRtdbServerTimestamp } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { entityConverter } from '@/lib/converters/entity-converter';
import { FieldValue } from 'firebase-admin/firestore';
import { EntityAuthError, EntityPermissionError, EntityDatabaseError, EntityQueryError, logRingError } from '@/lib/errors';

/**
 * Type definition for the data required to create a new entity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewEntityData = Omit<Entity, 'id' | 'dateCreated' | 'dateUpdated'>;

/**
 * Creates a new Entity in Firestore.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Validates the user's role and permissions.
 * 3. Processes the entity creation with server-side timestamp.
 * 4. Sets up presence detection for eligible user roles.
 * 5. Returns the created entity.
 * 
 * User steps:
 * 1. User must be authenticated before calling this function.
 * 2. User provides the necessary data for creating an entity.
 * 3. The function validates the user's permissions and the provided data.
 * 4. If validation passes, the entity is created and returned.
 * 
 * @param {NewEntityData} data - The data for the new entity.
 * @returns {Promise<Entity>} A promise that resolves to the created Entity object, including its generated ID.
 * @throws {EntityAuthError} If user authentication fails
 * @throws {EntityPermissionError} If user lacks permission to create entities
 * @throws {EntityDatabaseError} If database operations fail
 * @throws {EntityQueryError} If entity creation fails
 */
export async function createEntity(data: NewEntityData): Promise<Entity> {
  try {
    // Step 1: Authenticate the user
    const session = await auth();
    console.log('Services: createEntity - Starting entity creation process...');
    if (!session || !session.user) {
      throw new EntityAuthError('User authentication required to create entity', undefined, {
        timestamp: Date.now(),
        hasSession: !!session,
        hasUser: !!session?.user,
        operation: 'createEntity'
      });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    // Step 2: Validate user permissions
    if (!userId) {
      throw new EntityAuthError('Valid user ID required to create entity', undefined, {
        timestamp: Date.now(),
        session: !!session,
        operation: 'createEntity'
      });
    }

    if (data.isConfidential) {
      if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
        throw new EntityPermissionError('Only ADMIN or CONFIDENTIAL users can create confidential entities', undefined, {
          timestamp: Date.now(),
          userId,
          userRole,
          requiredRole: 'ADMIN or CONFIDENTIAL',
          operation: 'createEntity'
        });
      }
    } else {
      if (userRole !== UserRole.MEMBER && userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
        throw new EntityPermissionError('Only ADMIN, MEMBER, or CONFIDENTIAL users can create entities with presence', undefined, {
          timestamp: Date.now(),
          userId,
          userRole,
          requiredRole: 'ADMIN, MEMBER, or CONFIDENTIAL',
          operation: 'createEntity'
        });
      }
    }
    console.log(`Services: createEntity - User authenticated: ${userId} with role: ${userRole}`);

    // Step 3: Initialize database connection
    let adminDb;
    try {
      adminDb = await getAdminDb();
    } catch (error) {
      throw new EntityDatabaseError(
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

    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter);

    // Step 4: Create the new entity document
    const newEntityData = {
      ...data,
      createdBy: userId,
      dateCreated: FieldValue.serverTimestamp(),
      dateUpdated: FieldValue.serverTimestamp(),
    };

    let docRef;
    try {
      docRef = await entitiesCollection.add(newEntityData);
    } catch (error) {
      throw new EntityQueryError(
        'Failed to create entity document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          entityData: newEntityData,
          operation: 'entity_creation'
        }
      );
    }

    // Step 5: Retrieve the created entity
    let docSnap;
    try {
      docSnap = await docRef.get();
    } catch (error) {
      throw new EntityQueryError(
        'Failed to retrieve created entity',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId,
          userRole,
          entityId: docRef.id,
          operation: 'entity_retrieval'
        }
      );
    }

    const entityId = docRef.id;
    const entityData = docSnap.data() as Omit<Entity, 'id'>;

    // Construct the final Entity object, explicitly including the id
    const createdEntity: Entity = {
      id: entityId,
      ...entityData,
    };

    // Step 6: Set up presence detection for eligible user roles
    if (userRole === UserRole.ADMIN || userRole === UserRole.CONFIDENTIAL) {
      try {
        await setupPresenceDetection(entityId, entitiesCollection);
      } catch (error) {
        // Log presence detection error but don't fail the entire operation
        logRingError(error, `Services: createEntity - Presence detection setup failed for entity ${entityId}`);
      }
    }

    console.log(`Services: createEntity - Entity created successfully with ID: ${entityId}`);
    return createdEntity;

  } catch (error) {
    // Enhanced error logging with cause information
    logRingError(error, 'Services: createEntity - Error creating entity');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof EntityAuthError || 
        error instanceof EntityPermissionError ||
        error instanceof EntityDatabaseError ||
        error instanceof EntityQueryError) {
      throw error;
    }
    
    throw new EntityQueryError(
      'Unknown error occurred while creating entity',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        operation: 'createEntity'
      }
    );
  }
}

/**
 * Sets up presence detection for an entity using Firebase Realtime Database.
 * 
 * @param {string} entityId - The ID of the entity to set up presence detection for
 * @param {FirebaseFirestore.CollectionReference} entitiesCollection - The Firestore collection reference
 * @throws {EntityDatabaseError} If realtime database operations fail
 */
async function setupPresenceDetection(entityId: string, entitiesCollection: FirebaseFirestore.CollectionReference): Promise<void> {
  try {
    console.log('Services: createEntity - Enabling presence detection for eligible user roles.');

    const onlineRef = getAdminRtdbRef(`entities/${entityId}/online`);
    const lastOnlineRef = getAdminRtdbRef(`entities/${entityId}/lastOnline`);
    const connectedRef = getAdminRtdbRef('.info/connected');

    connectedRef.on('value', (snapshot) => {
      if (snapshot.val() === true) {
        console.log('Services: Realtime presence - Connected to Firebase Realtime Database.');

        setAdminRtdbData(`entities/${entityId}/online`, true);

        const onDisconnect = setAdminRtdbOnDisconnect(`entities/${entityId}/online`);
        onDisconnect.set(false);

        const lastOnlineDisconnect = setAdminRtdbOnDisconnect(`entities/${entityId}/lastOnline`);
        lastOnlineDisconnect.set(getAdminRtdbServerTimestamp());

        entitiesCollection.doc(entityId).update({
          onlineStatus: true,
        }).then(() => {
          console.log('Services: Firestore - Entity updated to online.');
        }).catch((error) => {
          logRingError(error, `Services: Firestore - Failed to update entity ${entityId} online status`);
        });
      } else {
        console.log('Services: Realtime presence - Not connected.');
      }
    });
  } catch (error) {
    throw new EntityDatabaseError(
      'Failed to set up presence detection',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        entityId,
        operation: 'setupPresenceDetection'
      }
    );
  }
}

