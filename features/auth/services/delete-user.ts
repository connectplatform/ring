// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminAuth } from '@/lib/firebase-admin.server';
import { deleteDocument } from '@/lib/services/firebase-service-manager';
import { UserRole } from '@/features/auth/types';
import { auth } from '@/auth';

/**
 * Delete a user from Firestore and Firebase Authentication, with authentication and role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the current user and validates their role
 * 2. Deletes the user's document from Firestore
 * 3. Deletes the user from Firebase Authentication
 * 
 * User steps:
 * 1. An admin user initiates the delete user action in the frontend
 * 2. Frontend calls this function with the ID of the user to be deleted
 * 3. Function authenticates the current user and validates their role
 * 4. If valid, the function deletes the user from Firestore and Firebase Authentication
 * 5. Function returns the result of the deletion operation
 * 
 * @param {string} userIdToDelete - The ID of the user to be deleted.
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating success (true) or failure (false).
 * 
 * @throws {Error} If the current user is not authenticated or not an admin
 * 
 * Error handling:
 * - Throws an error if the current user is not authenticated or not an admin
 * - Logs and returns false if there's an error during the deletion process
 */
export async function deleteUser(userIdToDelete: string): Promise<boolean> {
  console.log('Services: deleteUser - Starting user deletion process');

  try {
    // Step 1: Authenticate and get current user session
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access: User not authenticated');
    }

    const { id: currentUserId, role: currentUserRole } = session.user;

    // Step 2: Check if the current user has admin privileges
    if (currentUserRole !== UserRole.ADMIN) {
      throw new Error('Unauthorized access: Admin privileges required');
    }

    console.log(`Services: deleteUser - Admin authenticated with ID ${currentUserId}`);

    // Step 3: Delete user from Firestore using optimized deleteDocument
    await deleteDocument('users', userIdToDelete);
    console.log(`Services: deleteUser - User document deleted from Firestore for ID ${userIdToDelete}`);

    // Step 4: Delete user from Firebase Authentication
    const adminAuth = getAdminAuth();
    await adminAuth.deleteUser(userIdToDelete);
    console.log(`Services: deleteUser - User deleted from Firebase Authentication for ID ${userIdToDelete}`);

    console.log(`Services: deleteUser - User ${userIdToDelete} deleted successfully`);
    return true; // Indicate successful deletion

  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      const firebaseError = error as { code: string; message: string };
      console.error('Services: deleteUser - Firebase Admin error:', firebaseError.code, firebaseError.message);
    } else if (error instanceof Error) {
      console.error('Services: deleteUser - Error deleting user:', error.message);
    } else {
      console.error('Services: deleteUser - Unknown error occurred');
    }
    return false; // Indicate failure
  }
}

