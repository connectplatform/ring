// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { AuthUser } from '@/features/auth/types'
import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

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
export const getUserByWalletAddress = cache(async (walletAddress: string): Promise<AuthUser | null> => {
  console.log(`Services: getUserByWalletAddress - Starting retrieval process for wallet address: ${walletAddress}`);

  try {
    // Step 1: Authenticate and get session of the requesting user
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserByWalletAddress - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    // Step 2: Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Step 3: Query for user with the given wallet address
    const result = await db.query({
      collection: 'users',
      filters: [{ field: 'walletAddress', operator: '=', value: walletAddress }],
      pagination: { limit: 1 }
    })

    if (!result.success || !result.data) {
      console.log(`getUserByWalletAddress: No user found with wallet address: ${walletAddress}`)
      return null
    }

    const users = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    if (users.length === 0) {
      console.log(`getUserByWalletAddress: No user found with wallet address: ${walletAddress}`)
      return null
    }

    const userDoc = users[0]
    const userData = userDoc.data || userDoc

    // Step 4: Check authorization
    if (requestingUserId !== userDoc.id && requestingUserRole !== 'admin') {
      console.log(`getUserByWalletAddress: Unauthorized access attempt to user ${userDoc.id} by user ${requestingUserId}`)
      return null
    }

    console.log(`getUserByWalletAddress: User found and authorized for wallet address: ${walletAddress}`)
    
    return {
      id: userDoc.id,
      ...userData
    } as AuthUser

  } catch (error) {
    console.error('getUserByWalletAddress: Error:', error)
    return null
  }
})

