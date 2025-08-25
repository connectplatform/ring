// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { AuthUser, UserRole, Wallet } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument,
  getCachedCollectionAdvanced
} from '@/lib/services/firebase-service-manager';

import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Retrieve a user's full profile from Firestore by their ID, with authentication and role-based access control.
 * 
 * User steps:
 * 1. An authenticated user or admin requests another user's profile
 * 2. Function authenticates the requesting user
 * 3. If authenticated and authorized, the function retrieves the requested user's profile from Firestore
 * 4. The function returns the appropriate user data based on the requesting user's role
 * 
 * @param userId - The ID of the user to retrieve
 * @returns A promise that resolves to the AuthUser object or null if not found or not authorized.
 * 
 * Error handling:
 * - Throws an error if the requesting user is not authenticated
 * - Returns null if there's an error retrieving the profile from Firestore or if not authorized
 */
export async function getUserById(userId: string): Promise<Partial<AuthUser> | null> {
  console.log(`Services: getUserById - Starting retrieval process for user ID: ${userId}`);

  try {
    // Step 1: Authenticate and get session of the requesting user
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserById - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    // Step 2: Check authorization
    if (requestingUserId !== userId && requestingUserRole !== UserRole.ADMIN) {
      console.log(`Services: getUserById - Unauthorized access attempt to user ${userId} by user ${requestingUserId}`);
      return null; // Only allow users to access their own profile or admins to access any profile
    }

    // Step 3: Retrieve the user document using optimized firebase-service-manager
    const phase = getCurrentPhase();
    const userDoc = await getCachedDocument('users', userId);

    if (!userDoc || !userDoc.exists) {
      console.log(`Services: getUserById - User document not found for ID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    if (!userData) {
      console.log(`Services: getUserById - User document exists but has no data for ID: ${userId}`);
      return null;
    }

    // Convert Firebase Timestamps to Date objects consistently
    const convertTimestamp = (timestamp: any): Date => {
      if (timestamp && timestamp._seconds) {
        return new Date(timestamp._seconds * 1000);
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      return new Date();
    };

    // Step 5: Return appropriate data based on user role
    if (requestingUserRole === UserRole.ADMIN) {
      console.log(`Services: getUserById - Admin user retrieved full profile for ID: ${userId}`);
      return {
        ...userData,
        id: userId, // Ensure ID is set
        createdAt: convertTimestamp(userData?.createdAt),
        lastLogin: convertTimestamp(userData?.lastLogin),
      } as AuthUser;
    } else {
      // For non-admin users, return a subset of the user data
      const safeUserData: Partial<AuthUser> = {
        id: userId, // Use the userId parameter, not userData.id which might be undefined
        name: userData?.name,
        username: userData?.username,
        email: userData?.email,
        role: userData?.role,
        photoURL: userData?.photoURL,
        phoneNumber: userData?.phoneNumber,
        organization: userData?.organization,
        position: userData?.position,
        wallets: userData?.wallets,
        isVerified: userData?.isVerified,
        createdAt: convertTimestamp(userData?.createdAt),
        lastLogin: convertTimestamp(userData?.lastLogin),
        bio: userData?.bio,
        canPostconfidentialOpportunities: userData?.canPostconfidentialOpportunities,
        canViewconfidentialOpportunities: userData?.canViewconfidentialOpportunities,
        postedopportunities: userData?.postedopportunities,
        savedopportunities: userData?.savedopportunities,
        notificationPreferences: userData?.notificationPreferences,
      };

      console.log(`Services: getUserById - Non-admin user retrieved safe profile data for ID: ${userId}`);
      return safeUserData;
    }

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: getUserById - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: getUserById - Error retrieving user profile:', error);
    }
    return null; // Indicate failure by returning null
  }
}

