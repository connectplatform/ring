// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { AuthUser } from '@/features/auth/types'
import { cache } from 'react'
import { db } from '@/lib/database'

import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Retrieve a user's profile from Firestore by their wallet address, with authentication and role-based access control.
 */
export const getUserByWalletAddress = cache(async (walletAddress: string): Promise<AuthUser | null> => {
  console.log(`Services: getUserByWalletAddress - Starting retrieval process for wallet address: ${walletAddress}`);

  try {
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: requestingUserId, role: requestingUserRole } = session.user;

    console.log(`Services: getUserByWalletAddress - Requesting user authenticated with ID ${requestingUserId} and role ${requestingUserRole}`);

    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'walletAddress', operator: '=', value: walletAddress }],
      pagination: { limit: 1 },
    })

    if (!result.success || result.data.length === 0) {
      console.log(`getUserByWalletAddress: No user found with wallet address: ${walletAddress}`)
      return null
    }

    const userRow = result.data[0]

    if (requestingUserId !== userRow.id && requestingUserRole !== 'admin') {
      console.log(`getUserByWalletAddress: Unauthorized access attempt to user ${userRow.id} by user ${requestingUserId}`)
      return null
    }

    console.log(`getUserByWalletAddress: User found and authorized for wallet address: ${walletAddress}`)
    
    const { id, ...profileFields } = userRow
    return {
      id,
      ...profileFields
    } as AuthUser

  } catch (error) {
    console.error('getUserByWalletAddress: Error:', error)
    return null
  }
})
