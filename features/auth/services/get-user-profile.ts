/**
 * Get User Profile Service
 * 
 * Retrieves user profile from PostgreSQL database
 * Uses React 19 cache() for request deduplication
 */

import { AuthUser, UserRole, Wallet, NotificationPreferences, UserSettings } from '@/features/auth/types'
import { cache } from 'react'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

/**
 * Retrieve user profile from PostgreSQL database
 * 
 * @param userId - User ID to fetch
 * @returns AuthUser object or null if not found
 */
export async function getUserProfile(userId: string): Promise<AuthUser | null> {
  console.log('getUserProfile: Starting for user', userId)

  try {
    // Authenticate
    const session = await auth()
    if (!session || !session.user) {
      throw new Error('Unauthorized')
    }

    console.log('getUserProfile: Authenticated')

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Read user document
    const result = await db.findById('users', userId)

    if (!result.success || !result.data) {
      console.log('getUserProfile: User not found')
      return null
    }

    const userData = result.data as any
    const data = userData.data || userData

    // Build AuthUser object
    const userProfile: AuthUser = {
      id: userId,
      globalUserId: data.global_user_id || userId,
      email: data.email,
      emailVerified: data.emailVerified ? new Date(data.emailVerified) : null,
      name: data.name || null,
      role: data.role as UserRole,
      photoURL: data.photoURL || null,
      wallets: (data.wallets || []) as Wallet[],
      authProvider: data.authProvider,
      authProviderId: data.authProviderId,
      isVerified: data.isVerified || false,
      createdAt: new Date(data.createdAt || Date.now()),
      lastLogin: new Date(data.lastLogin || Date.now()),
      accountStatus: (data.account_status as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') || 'ACTIVE',
      bio: data.bio || undefined,
      canPostconfidentialOpportunities: data.canPostconfidentialOpportunities || false,
      canViewconfidentialOpportunities: data.canViewconfidentialOpportunities || false,
      postedopportunities: data.postedopportunities || [],
      savedopportunities: data.savedopportunities || [],
      nonce: data.nonce,
      nonceExpires: data.nonceExpires,
      notificationPreferences: data.notificationPreferences as NotificationPreferences || {
        email: true,
        inApp: true,
        sms: false,
      },
      settings: data.settings as UserSettings || {
        language: 'en',
        theme: 'system',
        notifications: true,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      },
    }

    console.log('getUserProfile: Success')
    return userProfile

  } catch (error) {
    console.error('getUserProfile: Error:', error)
    return null
  }
}

