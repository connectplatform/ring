/**
 * Get User By Username Service
 * 
 * Retrieves user from PostgreSQL database by username
 * Uses React 19 cache() for request deduplication
 */

import type { AuthUser } from '@/features/auth/types'
import { cache } from 'react'
import { db } from '@/lib/database'

/**
 * Resolve user profile by username
 */
export const getUserByUsername = cache(async (username: string): Promise<AuthUser | null> => {
  const usernameKey = username.trim().toLowerCase()
  if (!usernameKey) return null

  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'username', operator: '=', value: usernameKey }],
      pagination: { limit: 1 }
    })

    if (!result.success || result.data.length === 0) return null

    const row = result.data[0]

    return {
      id: row.id,
      email: row.email as string,
      emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
      name: (row.name as string) ?? null,
      username: row.username as string,
      role: row.role as AuthUser['role'],
      photoURL: (row.photoURL as string) ?? null,
      wallets: (row.wallets as AuthUser['wallets']) ?? [],
      authProvider: row.authProvider as string,
      authProviderId: row.authProviderId as string,
      isVerified: (row.isVerified as boolean) ?? false,
      createdAt: new Date(row.createdAt as string),
      lastLogin: new Date(row.lastLogin as string),
      bio: row.bio as string | undefined,
      canPostconfidentialOpportunities: (row.canPostconfidentialOpportunities as boolean) ?? false,
      canViewconfidentialOpportunities: (row.canViewconfidentialOpportunities as boolean) ?? false,
      postedopportunities: (row.postedopportunities as string[]) ?? [],
      savedopportunities: (row.savedopportunities as string[]) ?? [],
      nonce: row.nonce as string | undefined,
      nonceExpires: row.nonceExpires as number | undefined,
      notificationPreferences: (row.notificationPreferences as AuthUser['notificationPreferences']) ?? { email: true, inApp: true, sms: false },
      settings: (row.settings as AuthUser['settings']) ?? { language: 'en', theme: 'system', notifications: true, notificationPreferences: { email: true, inApp: true, sms: false } }
    } as AuthUser
  } catch (error) {
    console.error('getUserByUsername: Error:', error)
    return null
  }
})
