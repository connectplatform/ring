/**
 * Delete User Service
 * 
 * Permanently deletes a user from PostgreSQL database
 * Admin-only operation with authentication checks
 */

import { UserRole } from '@/features/auth/types'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

/**
 * Delete a user from PostgreSQL database
 * 
 * Admin-only operation that performs:
 * 1. Authentication check (Admin role required)
 * 2. Database deletion of user record
 * 3. Note: Auth.js session invalidation happens automatically on next request
 * 
 * @param {string} userIdToDelete - The ID of the user to be deleted
 * @returns {Promise<boolean>} Success/failure indicator
 * 
 * @throws {Error} If not authenticated or not an admin
 */
export async function deleteUser(userIdToDelete: string): Promise<boolean> {
  console.log('deleteUser: Starting user deletion process')

  try {
    // Step 1: Authenticate and check admin privileges
    const session = await auth()
    if (!session || !session.user) {
      throw new Error('Unauthorized access: User not authenticated')
    }

    const { id: currentUserId, role: currentUserRole } = session.user

    if (currentUserRole !== UserRole.ADMIN) {
      throw new Error('Unauthorized access: Admin privileges required')
    }

    console.log(`deleteUser: Admin authenticated with ID ${currentUserId}`)

    // Step 2: Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Step 3: Delete user from PostgreSQL
    const deleteResult = await db.delete('users', userIdToDelete)
    
    if (!deleteResult.success) {
      console.error(`deleteUser: Failed to delete user ${userIdToDelete}:`, deleteResult.error)
      return false
    }

    console.log(`deleteUser: User ${userIdToDelete} deleted successfully`)
    
    // Note: Auth.js sessions are handled separately and will be invalidated
    // on the next request when the user record is not found
    
    return true

  } catch (error) {
    console.error('deleteUser: Error:', error)
    return false
  }
}

