/**
 * Create Entity Service
 * 
 * Creates new entity with validation and role-based access control
 * Uses DatabaseService abstraction layer
 */

import { db } from '@/lib/database'
import { Entity } from '@/features/entities/types'
import { auth } from '@/auth'
import { assertKnownUserRole, hasConfidentialAccess, isPlatformAdmin } from '@/features/auth/user-role'
import { canCreateEntity } from '@/features/entities/lib/entity-permissions'
import { EntityAuthError, EntityPermissionError, EntityDatabaseError, EntityQueryError, logRingError } from '@/lib/errors'
import { validateEntityData, validateRequiredFields, hasOwnProperty } from '@/lib/utils'
import { syncEntityDiscovery } from '@/features/entities/lib/entity-mutation-sync'

/**
 * Type definition for the data required to create a new entity.
 * Excludes 'id', 'dateCreated', and 'dateUpdated' as these are generated server-side.
 */
type NewEntityData = Omit<Entity, 'id' | 'dateAdded' | 'lastUpdated'>;

/**
 * Creates a new Entity.
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

    const userId = session.user.id
    const userRole = assertKnownUserRole(session.user.role)

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

    if (!canCreateEntity(userRole, { isConfidential: Boolean(data.isConfidential) })) {
      throw new EntityPermissionError(
        data.isConfidential
          ? 'Only admin, superadmin or confidential users can create confidential entities'
          : 'Only member, confidential, or admin users can create entities',
        undefined,
        validationContext,
      );
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

    // Step 3: Create the new entity document with ES2022 logical assignment
    const newEntityData: any = {
      ...data,
      addedBy: userId,
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
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

    let createdEntity: Entity
    try {
      const result = await db().createDoc('entities', newEntityData)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create entity')
      }

      createdEntity = result.data as Entity
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

    const entityId = createdEntity.id

    // Step 6: Set up presence detection for eligible user roles
    if (isPlatformAdmin(userRole) || hasConfidentialAccess(userRole)) {
      try {
        // Use db.command() to get entity data for presence detection setup
        await db().findDocById('entities', entityId)
      } catch (error) {
        // Log any post-creation errors but don't fail the entire operation
        logRingError(error, `Services: createEntity - Presence detection setup failed for entity ${entityId}`);
      }
    }

    console.log(`Services: createEntity - Entity created successfully with ID: ${entityId}`);
    await syncEntityDiscovery({ entityId, event: 'created' })
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

// Note: Presence detection previously handled by Firebase RTDB has been removed
// Consider implementing presence detection via PostgreSQL or separate real-time service if needed

