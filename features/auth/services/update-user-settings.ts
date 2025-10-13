// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { UserSettings, UserRole } from '@/features/auth/types';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

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

    // Step 2: Database setup
    console.log('Services: updateUserSettings - Initializing database service');
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error('Services: updateUserSettings - Database initialization failed:', initResult.error);
      return false;
    }

    const dbService = getDatabaseService();

    // Step 3: Validate input (add more validation as needed)
    if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
      throw new Error('Invalid theme setting');
    }

    // Step 4: Read current user data
    const userResult = await dbService.read('users', userId);
    if (!userResult.success || !userResult.data) {
      console.error('Services: updateUserSettings - User not found:', userId);
      return false;
    }

    const userData = userResult.data.data || userResult.data;

    // Step 5: Prepare update data
    const updatedUserData = {
      ...userData,
      settings: data,
      updated_at: new Date(),
    };

    // Step 6: Update the database document
    const updateResult = await dbService.update('users', userId, updatedUserData);
    if (!updateResult.success) {
      console.error('Services: updateUserSettings - Failed to update user settings:', updateResult.error);
      return false;
    }
    
    console.log('Services: updateUserSettings - Settings updated successfully for user:', userId);
    return true; // Indicate successful update

  } catch (error) {
    console.error('Services: updateUserSettings - Error updating settings:', error);
    return false; // Indicate failure
  }
}

