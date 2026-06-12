/**
 * Update User Role Service
 * 
 * Updates user role in PostgreSQL database
 * Auth.js handles session management and role claims
 */

import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { db } from '@/lib/database'

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
    const role = session?.user?.role as UserRole | undefined
    if (!session?.user || ![UserRole.ADMIN, UserRole.SUPERADMIN].includes(role as UserRole)) {
      throw new Error('Unauthorized access: Admin privileges required');
    }

    console.log(`updateUserRole: Admin authenticated with ID ${session.user.id}`)

    const updateResult = await db().updateDoc('users', userId, {
      role: newRole,
      updatedAt: new Date()
    })

    if (!updateResult.success) {
      console.error('updateUserRole: Failed to update role:', updateResult.error)
      return false
    }

    console.log(`updateUserRole: Role updated successfully for user ${userId} to ${newRole}`)
    return true

  } catch (error) {
    console.error('updateUserRole: Error:', error)
    return false
  }
}

