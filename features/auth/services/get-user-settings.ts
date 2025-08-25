// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { UserSettings, UserRole } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument
} from '@/lib/services/firebase-service-manager';

import { auth } from '@/auth'; // Consistent session handling

/**
 * Retrieve a user's settings from Firestore, with authentication.
 * 
 * User steps:
 * 1. User accesses a page or component that requires their settings
 * 2. Frontend calls this function to fetch the user's settings
 * 3. Function authenticates the user
 * 4. If authenticated, the function retrieves the user's settings from Firestore
 * 
 * @returns A promise that resolves to the UserSettings object or null if not found.
 * 
 * Error handling:
 * - Throws an error if the user is not authenticated
 * - Returns null if there's an error retrieving the settings from Firestore
 */
export async function getUserSettings(): Promise<UserSettings | null> {
  console.log('Services: getUserSettings - Starting settings retrieval process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: getUserSettings - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Retrieve the user document using optimized firebase-service-manager
    const phase = getCurrentPhase();
    const userDoc = await getCachedDocument('users', userId);

    if (!userDoc || !userDoc.exists) {
      console.log(`Services: getUserSettings - User document not found for ID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();

    // Step 4: Extract and return the settings
    const userSettings: UserSettings = userData?.settings || {
      language: 'en',
      theme: 'system',
      notifications: true,
      notificationPreferences: {
        email: true,
        inApp: true,
        sms: false,
      },
    };

    console.log('Services: getUserSettings - Settings retrieved successfully for user:', userId);
    return userSettings;

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: getUserSettings - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: getUserSettings - Error retrieving settings:', error);
    }
    return null; // Indicate failure by returning null
  }
}

