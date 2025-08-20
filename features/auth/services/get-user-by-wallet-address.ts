import { getAdminDb } from '@/lib/firebase-admin.server';
import { AuthUser } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Retrieve a user's profile from Firestore by their wallet address, with authentication and role-based access control.
 * 
 * User steps:
 * 1. A user or system process requests to find a user by their wallet address
 * 2. Function authenticates the requesting user or process
 * 3. If authenticated and authorized, the function searches for a user with the given wallet address
 * 4. If found, the function returns the user's profile data
 * 
 * @param walletAddress - The wallet address to search for
 * @returns A promise that resolves to the AuthUser object or null if not found or not authorized
 * 
 * Error handling:
 * - Throws an error if the requesting user is not authenticated
 * - Returns null if there's an error retrieving the profile from Firestore or if not authorized
 */
export async function getUserByWalletAddress(walletAddress: string): Promise<AuthUser | null> {
  console.log(`Services: getUserByWalletAddress - Starting retrieval process for wallet address: ${walletAddress}`);

  try {
    // Step 1: Authenticate and get session of the requesting user
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserByWalletAddress - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    // Step 2: Firestore setup
    const adminDb = await getAdminDb();
    const usersRef = adminDb.collection('users');

    // Step 3: Query for user with the given wallet address
    const querySnapshot = await usersRef.where('walletAddress', '==', walletAddress).limit(1).get();

    if (querySnapshot.empty) {
      console.log(`Services: getUserByWalletAddress - No user found with wallet address: ${walletAddress}`);
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as AuthUser;

    // Step 4: Check authorization
    if (requestingUserId !== userData.id && requestingUserRole !== 'admin') {
      console.log(`Services: getUserByWalletAddress - Unauthorized access attempt to user ${userData.id} by user ${requestingUserId}`);
      return null; // Only allow users to access their own profile or admins to access any profile
    }

    console.log(`Services: getUserByWalletAddress - User found and authorized for wallet address: ${walletAddress}`);
    return userData;

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: getUserByWalletAddress - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: getUserByWalletAddress - Error retrieving user profile:', error);
    }
    return null; // Indicate failure by returning null
  }
}

