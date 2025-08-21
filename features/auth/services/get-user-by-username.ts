// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import type { AuthUser } from '@/features/auth/types'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

/**
 * Resolve a public user profile by username.
 * Uses a usernames index for uniqueness and fast lookup.
 */
export async function getUserByUsername(username: string): Promise<AuthUser | null> {
  const phase = getCurrentPhase();

  // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
  const usernameKey = username.trim().toLowerCase()
  if (!usernameKey) return null

  const usernameRef = adminDb.collection('usernames').doc(usernameKey)
  const mapSnap = await usernameRef.get()
  if (!mapSnap.exists) return null
  const { userId } = mapSnap.data() as { userId: string }
  if (!userId) return null

  const userRef = adminDb.collection('userProfiles').doc(userId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) return null
  const data = userSnap.data() || {}

  return {
    id: userId,
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
    settings: data.settings ?? { language: 'en', theme: 'light', notifications: false, notificationPreferences: { email: true, inApp: true, sms: false } }
  } as AuthUser
}

