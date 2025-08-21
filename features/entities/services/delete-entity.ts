// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminDb, getAdminRtdbRef, setAdminRtdbData } from '@/lib/firebase-admin.server';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection, getCachedEntities } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

import { auth } from '@/auth'; // Auth.js v5 handler for session management
import { UserRole } from '@/features/auth/types';
import { Entity } from '@/features/entities/types';
import { checkEntityOwnership } from '@/features/entities/utils/entity-utils';
import { invalidateEntitiesCache } from '@/lib/cached-data'

/**
 * Deletes an entity by its ID from the Firestore collection and removes its presence data from Realtime Database.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session using Auth.js v5.
 * 2. Checks the user's role and ownership for access control.
 * 3. Retrieves the entity from Firestore to verify its existence and confidentiality status.
 * 4. Enforces permission rules based on the user's role, ownership, and the entity's confidentiality.
 * 5. Deletes the entity from Firestore if all checks pass.
 * 6. Removes the entity's presence data from Realtime Database.
 * 
 * User steps:
 * 1. User initiates a delete request for an entity.
 * 2. The system verifies the user's authentication and authorization.
 * 3. If authorized, the system deletes the entity and its associated data.
 * 4. The user receives confirmation of successful deletion or an error message.
 * 
 * @param {string} id - The unique identifier of the entity to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
 * @throws {Error} If the user is not authenticated, lacks the necessary permissions, or if the entity doesn't exist.
 * 
 * Note: Only ADMIN users can delete any entity. Other users can only delete entities they have added,
 *       unless the entity is confidential, in which case only ADMIN and CONFIDENTIAL users have permission.
 */
export async function deleteEntity(id: string): Promise<boolean> {
  try {
    console.log('Services: deleteEntity - Starting deletion of entity:', id);

    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: deleteEntity - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Access Firestore and get the entity document
    // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    const phase = getCurrentPhase();
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const entitiesCollection = adminDb.collection('entities');
    const entityDoc = await entitiesCollection.doc(id).get();

    // Step 3: Check if the entity exists
    if (!entityDoc.exists) {
      console.warn('Services: deleteEntity - No entity found with ID:', id);
      throw new Error(`Entity with ID ${id} not found.`);
    }

    const entity = entityDoc.data() as Entity;

    // Step 4: Check user's permission to delete the entity
    const isOwner = await checkEntityOwnership(userId, id);
    if (userRole !== UserRole.ADMIN && !isOwner) {
      console.error(`Services: deleteEntity - User ${userId} attempted to delete entity ${id} without permission`);
      throw new Error('You do not have permission to delete this entity.');
    }

    // Step 5: If the entity is confidential, ensure the user has appropriate permissions
    if (entity.isConfidential && userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      console.error(`Services: deleteEntity - Non-admin/confidential user ${userId} attempted to delete confidential entity ${id}`);
      throw new Error('You do not have permission to delete confidential entities.');
    }

    // Step 6: Delete the entity from Firestore
    await entitiesCollection.doc(id).delete();

    // Step 7: Remove presence data from Realtime Database
    const entityPresenceRef = getAdminRtdbRef(`entities/${id}`);
    await setAdminRtdbData(entityPresenceRef.toString(), null);

    console.log('Services: deleteEntity - Entity deleted successfully:', id);
    invalidateEntitiesCache(['public','subscriber','member','confidential','admin'])
    return true;
  } catch (error) {
    console.error('Services: deleteEntity - Error deleting entity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while deleting entity');
  }
}

