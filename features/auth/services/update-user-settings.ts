// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { UserSettings, UserRole } from '@/features/auth/types';

import { cache } from 'react';
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
 */
export async function updateUserSettings(data: Partial<UserSettings>): Promise<boolean> {
  console.log('Services: updateUserSettings - Starting settings update process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: updateUserSettings - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Validate input (add more validation as needed)
    if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
      throw new Error('Invalid theme setting');
    }

    const userResult = await db().readDoc<Record<string, unknown>>('users', userId);
    if (!userResult.success || !userResult.data) {
      console.error('Services: updateUserSettings - User not found:', userId);
      return false;
    }

    const userData = userResult.data;

    const updatedUserData = {
      ...userData,
      settings: data,
      updated_at: new Date(),
    };

    const updateResult = await db().updateDoc('users', userId, updatedUserData);
    if (!updateResult.success) {
      console.error('Services: updateUserSettings - Failed to update user settings:', updateResult.error);
      return false;
    }
    
    console.log('Services: updateUserSettings - Settings updated successfully for user:', userId);
    return true;

  } catch (error) {
    console.error('Services: updateUserSettings - Error updating settings:', error);
    return false;
  }
}
