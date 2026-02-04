/**
 * Get User By Username Service
 * 
 * Retrieves user from PostgreSQL database by username
 * Uses React 19 cache() for request deduplication
 */

import type { AuthUser } from '@/features/auth/types'
import { cache } from 'react'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

/**
 * Resolve user profile by username
 */
export const getUserByUsername = cache(async (username: string): Promise<AuthUser | null> => {
  const usernameKey = username.trim().toLowerCase()
  if (!usernameKey) return null

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // Query users by username field
    const result = await db.query({
      collection: 'users',
      filters: [{ field: 'username', operator: '=', value: usernameKey }],
      pagination: { limit: 1 }
    })

    if (!result.success || !result.data) return null

    const users = Array.isArray(result.data) ? result.data : (result.data as any).data || []
    if (users.length === 0) return null

    const userData = users[0]
    const data = userData.data || userData

    return {
      id: userData.id,
      email: data.email,
      emailVerified: data.emailVerified ? new Date(data.emailVerified) : null,
      name: data.name ?? null,
      username: data.username,
      role: data.role,
      photoURL: data.photoURL ?? null,
      wallets: data.wallets ?? [],
      authProvider: data.authProvider,
      authProviderId: data.authProviderId,
      isVerified: data.isVerified ?? false,
      createdAt: new Date(data.createdAt),
    lastLogin: new Date(data.lastLogin),
    bio: data.bio,
    canPostconfidentialOpportunities: data.canPostconfidentialOpportunities ?? false,
    canViewconfidentialOpportunities: data.canViewconfidentialOpportunities ?? false,
    postedopportunities: data.postedopportunities ?? [],
    savedopportunities: data.savedopportunities ?? [],
    nonce: data.nonce,
    nonceExpires: data.nonceExpires,
      notificationPreferences: data.notificationPreferences ?? { email: true, inApp: true, sms: false },
      settings: data.settings ?? { language: 'en', theme: 'system', notifications: true, notificationPreferences: { email: true, inApp: true, sms: false } }
    } as AuthUser
  } catch (error) {
    console.error('getUserByUsername: Error:', error)
    return null
  }
})

