import { getAdminDb } from '@/lib/firebase-admin.server';
import { AuthUser, UserRole, Wallet, NotificationPreferences, UserSettings } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Retrieve a user's profile from Firestore, with authentication.
 * 
 * User steps:
 * 1. User accesses a page or component that requires their profile
 * 2. Frontend calls this function to fetch the user's profile
 * 3. Function authenticates the user
 * 4. If authenticated, the function retrieves the user's profile from Firestore
 * 
 * @param userId - The ID of the user whose profile to fetch
 * @returns A promise that resolves to the AuthUser object or null if not found.
 * 
 * Error handling:
 * - Throws an error if the user is not authenticated
 * - Returns null if there's an error retrieving the profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<AuthUser | null> {
  console.log('Services: getUserProfile - Starting profile retrieval process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: sessionUserId, role: sessionUserRole } = session.user;

    console.log(`Services: getUserProfile - User authenticated with ID ${sessionUserId} and role ${sessionUserRole}`);

    // Step 2: Firestore setup
    const adminDb = await getAdminDb();
    const userRef = adminDb.collection('userProfiles').doc(userId);

    // Step 3: Retrieve the user document
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`Services: getUserProfile - User document not found for ID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();

    if (!userData) {
      console.log(`Services: getUserProfile - User data is empty for ID: ${userId}`);
      return null;
    }

    // Step 4: Extract and return the user profile
    const userProfile: AuthUser = {
      id: userId,
      email: userData.email,
      emailVerified: userData.emailVerified ? new Date(userData.emailVerified) : null,
      name: userData.name || null,
      role: userData.role as UserRole,
      photoURL: userData.photoURL || null,
      wallets: (userData.wallets || []) as Wallet[],
      authProvider: userData.authProvider,
      authProviderId: userData.authProviderId,
      isVerified: userData.isVerified,
      createdAt: new Date(userData.createdAt),
      lastLogin: new Date(userData.lastLogin),
      bio: userData.bio || undefined,
      canPostconfidentialOpportunities: userData.canPostconfidentialOpportunities,
      canViewconfidentialOpportunities: userData.canViewconfidentialOpportunities,
      postedopportunities: userData.postedopportunities || [],
      savedopportunities: userData.savedopportunities || [],
      nonce: userData.nonce,
      nonceExpires: userData.nonceExpires,
      notificationPreferences: userData.notificationPreferences as NotificationPreferences || {
        email: true,
        inApp: true,
        sms: false,
      },
      settings: userData.settings as UserSettings || {
        language: 'en',
        theme: 'light',
        notifications: false,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      },
    };

    console.log('Services: getUserProfile - Profile retrieved successfully for user:', userId);
    return userProfile;

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: getUserProfile - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: getUserProfile - Error retrieving profile:', error);
    }
    return null; // Indicate failure by returning null
  }
}

