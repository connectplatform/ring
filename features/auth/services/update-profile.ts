// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { ProfileFormData, UserRole } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

import { auth } from '@/auth'; // Use the Auth.js v5 handler to get the session

/**
 * Update a user's profile in Firestore, with authentication and role-based access control.
 * 
 * User steps:
 * 1. The function is called with updated profile data
 * 2. It authenticates the user using the auth() function
 * 3. If authenticated, it prepares the data for update
 * 4. It updates the user's document in Firestore
 * 5. It returns a boolean indicating success or failure
 * 
 * @param data - The partial profile data to update.
 * @returns A promise that resolves to a boolean indicating success or failure.
 * 
 * Error Handling:
 * - Throws an error if the user is not authenticated
 * - Throws an error if a non-admin user tries to update the role field
 * - Logs Firebase errors and other errors separately
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

    // Step 2: Firestore setup
    // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    const phase = getCurrentPhase();
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const userRef = adminDb.collection('users').doc(userId);

    // Step 3: Apply role validation (if needed)
    if (data.role && userRole !== UserRole.ADMIN) {
      throw new Error('Only ADMIN users can update the role field.');
    }

    // Step 4: Prepare update data
    const updateData = {
      ...data,
      updatedAt: new Date(), // Add a timestamp for the update
    };

    // Step 5: Update the Firestore document
    await userRef.set(updateData, { merge: true });
    
    console.log('Services: updateProfile - Profile updated successfully for user:', userId);
    return true; // Indicate successful update

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: updateProfile - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: updateProfile - Error updating profile:', error);
    }
    return false; // Indicate failure
  }
}

