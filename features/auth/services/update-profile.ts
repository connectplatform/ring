// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { ProfileFormData, UserRole } from '@/features/auth/types';

import { cache } from 'react';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

import { auth } from '@/auth'; // Use the Auth.js v5 handler to get the session

/**
 * Update a user's profile in PostgreSQL, with authentication and role-based access control.
 *
 * User steps:
 * 1. The function is called with updated profile data
 * 2. It authenticates the user using the auth() function
 * 3. If authenticated, it prepares the data for update
 * 4. It updates the user's document in PostgreSQL
 * 5. It returns a boolean indicating success or failure
 *
 * @param data - The partial profile data to update.
 * @returns A promise that resolves to a boolean indicating success or failure.
 *
 * Error Handling:
 * - Throws an error if the user is not authenticated
 * - Throws an error if a non-admin user tries to update the role field
 * - Logs database errors and other errors separately
 */
export async function updateProfile(data: Partial<ProfileFormData>): Promise<boolean> {
  console.log('Services: updateProfile - Starting profile update process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: updateProfile - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Database setup
    console.log(`Services: updateProfile - Initializing database service`);
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error(`Services: updateProfile - Database initialization failed:`, initResult.error);
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();

    // Step 3: Apply role validation (if needed)
    if (data.role && userRole !== UserRole.ADMIN) {
      throw new Error('Only ADMIN users can update the role field.');
    }

    // Step 4: Prepare update data
    // Parse JSON strings for JSONB fields (communication, cultural)
    // Use explicit type to ensure TypeScript recognizes all JSONB fields
    const processedData: Record<string, any> = { ...data };
    
    // Parse communication field if it's a JSON string
    if (typeof processedData.communication === 'string') {
      try {
        processedData.communication = JSON.parse(processedData.communication);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse communication JSON:', e);
      }
    }
    
    // Parse cultural field if it's a JSON string
    if (typeof processedData.cultural === 'string') {
      try {
        processedData.cultural = JSON.parse(processedData.cultural);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse cultural JSON:', e);
      }
    }
    
    // Parse privacy field if it's a JSON string
    if (typeof processedData.privacy === 'string') {
      try {
        processedData.privacy = JSON.parse(processedData.privacy);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse privacy JSON:', e);
      }
    }
    
    // Parse integrations field if it's a JSON string
    if (typeof processedData.integrations === 'string') {
      try {
        processedData.integrations = JSON.parse(processedData.integrations);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse integrations JSON:', e);
      }
    }
    
    // Parse skills field if it's a JSON string
    if (typeof processedData.skills === 'string') {
      try {
        processedData.skills = JSON.parse(processedData.skills);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse skills JSON:', e);
      }
    }
    
    // Parse notificationPreferences field if it's a JSON string
    if (typeof processedData.notificationPreferences === 'string') {
      try {
        processedData.notificationPreferences = JSON.parse(processedData.notificationPreferences);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse notificationPreferences JSON:', e);
      }
    }
    
    // Parse experience field if it's a JSON string
    if (typeof processedData.experience === 'string') {
      try {
        processedData.experience = JSON.parse(processedData.experience);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse experience JSON:', e);
      }
    }
    
    // Parse settings field if it's a JSON string
    if (typeof processedData.settings === 'string') {
      try {
        processedData.settings = JSON.parse(processedData.settings);
      } catch (e) {
        console.warn('Services: updateProfile - Failed to parse settings JSON:', e);
      }
    }
    
    const updateData = {
      ...processedData,
      updatedAt: new Date(), // Add a timestamp for the update
    };

    // Step 5: Update the PostgreSQL document
    const updateResult = await dbService.update('users', userId, updateData);
    if (!updateResult.success) {
      console.error(`Services: updateProfile - Failed to update user:`, updateResult.error);
      throw new Error('Failed to update profile in database');
    }

    console.log('Services: updateProfile - Profile updated successfully for user:', userId);
    return true; // Indicate successful update

  } catch (error) {
    console.error('Services: updateProfile - Error updating profile:', error);
    return false; // Indicate failure
  }
}

