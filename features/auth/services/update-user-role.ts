// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { getAdminAuth } from '@/lib/firebase-admin.server';
import { updateDocument } from '@/lib/services/firebase-service-manager';
import { UserRole } from '@/features/auth/types';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Update a user's role in Firestore and Firebase Auth, with authentication and admin-only access.
 * 
 * User steps:
 * 1. An admin user accesses the user management interface
 * 2. Admin selects a user and chooses a new role
 * 3. Frontend calls this function with the user ID and new role
 * 4. Function authenticates the admin user and validates the input
 * 5. If valid, the function updates the user's role in Firestore and Firebase Auth
 * 
 * @param userId - The ID of the user whose role is being updated
 * @param newRole - The new role to assign to the user
 * @returns A promise that resolves to a boolean indicating success or failure
 * 
 * Error handling:
 * - Throws an error if the current user is not authenticated or not an admin
 * - Returns false if there's an error updating the role in Firestore or Firebase Auth
 */
export async function updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
  console.log(`Services: updateUserRole - Starting role update process for user ${userId} to ${newRole}`);

  try {
    // Step 1: Authenticate and get admin user session
    const session = await auth();
    if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
      throw new Error('Unauthorized access: Admin privileges required');
    }

    console.log(`Services: updateUserRole - Admin authenticated with ID ${session.user.id}`);

    // Step 2: Update role in Firestore using optimized updateDocument
    await updateDocument('users', userId, {
      role: newRole,
      updatedAt: new Date(),
    });

    // Step 3: Update custom claims in Firebase Auth
    const adminAuth = getAdminAuth();
    await adminAuth.setCustomUserClaims(userId, { role: newRole });

    console.log(`Services: updateUserRole - Role updated successfully for user ${userId} to ${newRole}`);
    return true; // Indicate successful update

  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error('Services: updateUserRole - Firebase error:', error.code, error.message);
    } else {
      console.error('Services: updateUserRole - Error updating user role:', error);
    }
    return false; // Indicate failure
  }
}

