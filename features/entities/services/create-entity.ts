// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminDb, getAdminRtdb, getAdminRtdbRef, setAdminRtdbData, setAdminRtdbOnDisconnect, getAdminRtdbServerTimestamp } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';
import { entityConverter } from '@/lib/converters/entity-converter';
import { FieldValue } from 'firebase-admin/firestore';
import { EntityAuthError, EntityPermissionError, EntityDatabaseError, EntityQueryError, logRingError } from '@/lib/errors';
import { validateEntityData, validateRequiredFields, hasOwnProperty } from '@/lib/utils';
import { invalidateEntitiesCache } from '@/lib/cached-data'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedEntities } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

/**
 * Type definition for the data required to create a new entity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewEntityData = Omit<Entity, 'id' | 'dateAdded' | 'lastUpdated'>;

/**
 * Creates a new Entity in Firestore with ES2022 enhancements.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Validates the user's role and permissions using Object.hasOwn() for safe property checking.
 * 3. Processes the entity creation with logical assignment operators for cleaner state management.
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

    // ES2022 Logical Assignment Operators for cleaner validation
    const validationContext = {
      timestamp: Date.now(),
      operation: 'createEntity'
    } as any;
    
    // Use ??= to assign default values only if undefined/null
    validationContext.userId ??= userId;
    validationContext.userRole ??= userRole;
    validationContext.hasSession ??= !!session;
    validationContext.hasUser ??= !!session?.user;

    // Step 2: Enhanced validation with ES2022 Object.hasOwn() and logical operators
    if (!userId) {
      throw new EntityAuthError('Valid user ID required to create entity', undefined, validationContext);
    }

    // ES2022 Object.hasOwn() for safe property checking
    if (Object.hasOwn(data, 'isConfidential') && data.isConfidential) {
      const hasConfidentialAccess = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN;
      
      if (!hasConfidentialAccess) {
        // Use &&= for conditional assignment
        validationContext.requiredRole &&= 'ADMIN or CONFIDENTIAL';
        throw new EntityPermissionError('Only ADMIN or CONFIDENTIAL users can create confidential entities', undefined, validationContext);
      }
    } else {
      // Use logical OR for multiple role checking
      const hasEntityAccess = [UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL].includes(userRole);
      
      if (!hasEntityAccess) {
        validationContext.requiredRole ??= 'ADMIN, MEMBER, or CONFIDENTIAL';
        throw new EntityPermissionError('Only ADMIN, MEMBER, or CONFIDENTIAL users can create entities', undefined, validationContext);
      }
    }
    
    console.log(`Services: createEntity - User authenticated: ${userId} with role: ${userRole}`);

    // Step 2.5: Enhanced data validation using ES2022 utilities
    if (!validateEntityData(data)) {
      throw new EntityQueryError('Invalid entity data provided', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields: ['name', 'type', 'description']
      });
    }

    // Additional validation using validateRequiredFields and hasOwnProperty  
    const requiredFields: (keyof NewEntityData)[] = ['name', 'type', 'shortDescription'];
    if (!validateRequiredFields(data, requiredFields)) {
      throw new EntityQueryError('Missing required fields for entity creation', undefined, {
        ...validationContext,
        providedData: data,
        requiredFields,
        missingFields: requiredFields.filter(field => !hasOwnProperty(data, field))
      });
    }

    // Validate optional array fields using hasOwnProperty for safe property checking
    if (hasOwnProperty(data, 'tags') && data.tags) {
      if (!Array.isArray(data.tags)) {
        throw new EntityQueryError('Tags must be an array', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'tags'
        });
      }
    }

    if (hasOwnProperty(data, 'services') && data.services) {
      if (!Array.isArray(data.services)) {
        throw new EntityQueryError('Services must be an array', undefined, {
          ...validationContext,
          providedData: data,
          invalidField: 'services'
        });
      }
    }

    // Step 3: Initialize database connection
    let adminDb;
    const dbContext = { ...validationContext, operation: 'getAdminDb' };
    
    try {
      const serviceManager = getFirebaseServiceManager();
      adminDb = serviceManager.db;
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to initialize database connection',
        error instanceof Error ? error : new Error(String(error)),
        dbContext
      );
    }

    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter);

    // Step 4: Create the new entity document with ES2022 logical assignment
    const newEntityData: any = {
      ...data,
      addedBy: userId,
      dateAdded: FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp(),
    };
    
    // ES2022 ??= logical assignment - set default values if not provided
    newEntityData.tags ??= [];
    newEntityData.services ??= [];
    newEntityData.certifications ??= [];
    newEntityData.industries ??= [];
    newEntityData.members ??= [];
    newEntityData.opportunities ??= [];
    newEntityData.partnerships ??= [];
    
    // ES2022 ||= logical assignment - set defaults for optional fields
    newEntityData.visibility ||= 'public';
    newEntityData.isConfidential ||= false;

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
    // Invalidate cache for possible role keys
    invalidateEntitiesCache(['public','subscriber','member','confidential','admin'])
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

