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
import { getDatabaseService, initializeDatabase } from '@/lib/database';

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

    // Step 3: Retrieve the user document using database abstraction layer
    console.log(`Services: getUserById - Using database abstraction layer for user: ${userId}`);

    try {
      // Initialize database service if needed
      console.log(`Services: getUserById - Initializing database service`);
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        console.error(`Services: getUserById - Database initialization failed:`, initResult.error);
        // Fallback to Firebase direct access if database initialization fails
        console.log(`Services: getUserById - Falling back to Firebase direct access`);
        const fallbackDoc = await getCachedDocument('users', userId);
        if (fallbackDoc && fallbackDoc.exists) {
          const fallbackData = fallbackDoc.data();
          console.log(`Services: getUserById - Fallback successful for user: ${userId}`);
          return {
            id: userId,
            name: fallbackData?.name,
            username: fallbackData?.username,
            email: fallbackData?.email,
            role: fallbackData?.role,
            photoURL: fallbackData?.photoURL,
            phoneNumber: fallbackData?.phoneNumber,
            organization: fallbackData?.organization,
            position: fallbackData?.position,
            wallets: fallbackData?.wallets,
            isVerified: fallbackData?.isVerified,
            createdAt: new Date(fallbackData?.createdAt?._seconds * 1000 || Date.now()),
            lastLogin: new Date(fallbackData?.lastLogin?._seconds * 1000 || Date.now()),
            bio: fallbackData?.bio,
            canPostconfidentialOpportunities: fallbackData?.canPostconfidentialOpportunities,
            canViewconfidentialOpportunities: fallbackData?.canViewconfidentialOpportunities,
            postedopportunities: fallbackData?.postedopportunities,
            savedopportunities: fallbackData?.savedopportunities,
            notificationPreferences: fallbackData?.notificationPreferences,
          } as Partial<AuthUser>;
        }
        return null;
      }

      console.log(`Services: getUserById - Database initialization successful`);

      const dbService = getDatabaseService();
      const userResult = await dbService.read('users', userId);

      if (!userResult.success || !userResult.data) {
        console.log(`Services: getUserById - User document not found for ID: ${userId}`);
        console.log(`Services: getUserById - Database result:`, userResult);
        return null;
      }

      const dbDocument = userResult.data;
      console.log(`Services: getUserById - Successfully retrieved database document for ID: ${userId}`, {
        hasDocument: !!dbDocument,
        documentType: typeof dbDocument,
        documentKeys: dbDocument ? Object.keys(dbDocument) : []
      });

      if (!dbDocument) {
        console.log(`Services: getUserById - No document found in database result`);
        return null;
      }

    // Convert timestamps to Date objects consistently
    const convertTimestamp = (timestamp: any): Date => {
      if (timestamp && timestamp._seconds) {
        // Firebase timestamp format
        return new Date(timestamp._seconds * 1000);
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      // PostgreSQL timestamp format (ISO string)
      if (typeof timestamp === 'object' && timestamp.toISOString) {
        return timestamp;
      }
      return new Date();
    };

    // Extract the actual data from the database document
    const userData = (dbDocument as any).data || dbDocument;
    console.log(`Services: getUserById - Extracted user data:`, {
      hasData: !!userData,
      dataKeys: userData ? Object.keys(userData) : [],
      dataType: typeof userData
    });

    if (!userData) {
      console.log(`Services: getUserById - No data found in database document`);
      return null;
    }

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
      console.error('Services: getUserById - Error retrieving user profile:', error);
      console.error('Services: getUserById - Error details:', {
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null; // Indicate failure by returning null
    }
  } catch (error) {
    console.error('Services: getUserById - Authentication or authorization error:', error);
    return null; // Indicate failure by returning null
  }
}

