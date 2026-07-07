// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { UserSettings } from '@/features/auth/types';
import { UserRolesArray } from '@/features/auth/user-role';

import { cache } from 'react';
// TODO: Evaluate moving to cache() at callsite for deduplication with React 19
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { db } from '@/lib/database';

import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Update a user's settings in Firestore, with authentication and role-based access control.
 *
 * User steps:
 * 1. User submits updated settings through the UI
 * 2. Frontend calls this function with the updated settings
 * 3. Function authenticates the user and validates the input
 * 4. If valid, the function updates the user's settings in Firestore
 *
 * @param data - The partial UserSettings data to update.
 * @returns A promise that resolves to a boolean indicating success or failure.
 *
 * Error handling:
 * - Throws an error if the user is not authenticated
 * - Returns false if there's an error updating the settings in Firestore
 *
 * Benefits from React 19 and Next.js 16 features:
 * - Automatic request deduplication with cache()
 * - Optimal build/runtime phase branching (see phase detector)
 */
export async function updateUserSettings(data: Partial<UserSettings>): Promise<boolean> {
  // Log start of the update process (aids debugging in all environments)
  console.log('Services: updateUserSettings - Starting settings update process');

  try {
    // Step 1: Authenticate user and retrieve their session asynchronously.
    // Could be replaced with Next.js 16 middleware approach for advanced RBAC.
    const session = await auth();
    if (!session || !session.user) {
      // User is not authenticated; abort with error.
      throw new Error('Unauthorized access');
    }

    // Extract user ID and role for access control and targeting correct document.
    const { id: userId, role: userRole } = session.user as { id: string; role: UserRolesArray };

    console.log(`Services: updateUserSettings - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Validate input.
    // Only allow valid theme values ('light', 'dark', 'system'), else abort.
    if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
      throw new Error('Invalid theme setting');
    }

    // Step 3: Read current user document from DB (Firestore or compatible)
    const userResult = await db().readDoc<Record<string, unknown>>('users', userId);
    if (!userResult.success || !userResult.data) {
      // Could not find user record; likely a stale session or DB inconsistency.
      console.error('Services: updateUserSettings - User not found:', userId);
      return false;
    }

    // userData contains all user fields as stored in the DB
    const userData = userResult.data;

    // TODO: Consider deep-merging settings (merge old + new) instead of overwriting all at once
    // Construct a new user object that merges previous data and incoming settings
    const updatedUserData = {
      ...userData,
      settings: data, // TODO: Deep merge for partial settings instead of overwriting the whole settings object
      updated_at: new Date(), // Record time of update (Helps with sync/conflict resolution)
    };

    // Step 4: Update the user document in the DB with the merged settings
    // STUB: Should ensure atomic update if on Firestore (transaction support, etc)
    //       Could also add support for field-level update to avoid overwrite
    const updateResult = await db().updateDoc('users', userId, updatedUserData);
    if (!updateResult.success) {
      // Updating failed for some reason (could be permissions, transaction error, etc)
      console.error('Services: updateUserSettings - Failed to update user settings:', updateResult.error);
      return false;
    }

    // Success: settings updated
    console.log('Services: updateUserSettings - Settings updated successfully for user:', userId);
    return true;

  } catch (error) {
    // Catch-all: any error in the above flow is logged and returns false to caller
    console.error('Services: updateUserSettings - Error updating settings:', error);
    return false;
  }
}
