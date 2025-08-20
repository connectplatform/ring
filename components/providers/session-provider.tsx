'use client'

import React from 'react'
import { useSession as useBetterAuthSession } from '@/lib/auth-client'

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  return <>{children}</>
}

// Export useSession that uses BetterAuth client
export const useSession = () => {
  const betterAuthSession = useBetterAuthSession()
  
  // Transform BetterAuth session to match NextAuth structure for compatibility
  const transformedSession = React.useMemo(() => {
    // Handle loading state
    if (betterAuthSession?.isPending) {
      return {
        data: null,
        status: 'loading' as const,
        user: null,
        update: async () => {
          console.warn('Session update not implemented in BetterAuth')
        }
      }
    }
    
    // Handle error or no session
    if (!betterAuthSession?.data?.user) {
      return {
        data: null,
        status: 'unauthenticated' as const,
        user: null,
        update: async () => {
          console.warn('Session update not implemented in BetterAuth')
        }
      }
    }
    
    // Helper function to safely parse JSON strings
    const safeJsonParse = (jsonString: string | undefined | null, fallback: any) => {
      if (!jsonString || typeof jsonString !== 'string') return fallback
      try {
        return JSON.parse(jsonString)
      } catch {
        return fallback
      }
    }

    // Fetch full user data from Firestore to enrich BetterAuth user
    const betterAuthUser = betterAuthSession.data.user
    let firestoreUserData = null
    
    try {
      // Fetch user data from Firestore (server-side only)
      if (typeof window === 'undefined') {
        const { getAdminDb } = await import('@/lib/firebase-admin.server')
        const db = getAdminDb()
        const userDoc = await db.collection('users').doc(betterAuthUser.id).get()
        if (userDoc.exists) {
          firestoreUserData = userDoc.data()
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user data from Firestore:', error)
    }

    // Create NextAuth-compatible session structure with enriched user data
    const sessionData = {
      user: {
        // BetterAuth base fields
        id: betterAuthUser.id,
        email: betterAuthUser.email || '',
        name: betterAuthUser.name || '',
        image: betterAuthUser.image || null,
        emailVerified: typeof betterAuthUser.emailVerified === 'boolean' 
          ? (betterAuthUser.emailVerified ? new Date() : null) 
          : betterAuthUser.emailVerified ? new Date(betterAuthUser.emailVerified) : null,
        createdAt: betterAuthUser.createdAt,
        updatedAt: betterAuthUser.updatedAt,
        
        // Ring-specific fields from Firestore (with fallbacks)
        role: firestoreUserData?.role || 'SUBSCRIBER',
        wallets: firestoreUserData?.wallets ? safeJsonParse(firestoreUserData.wallets, []) : [],
        isSuperAdmin: firestoreUserData?.isSuperAdmin || false,
        isVerified: firestoreUserData?.isVerified || betterAuthUser.emailVerified || false,
        username: firestoreUserData?.username || betterAuthUser.name || null,
        authProvider: firestoreUserData?.authProvider || 'email',
        authProviderId: firestoreUserData?.authProviderId || betterAuthUser.id,
        lastLogin: firestoreUserData?.lastLogin ? new Date(firestoreUserData.lastLogin.seconds * 1000) : new Date(),
        bio: firestoreUserData?.bio || null,
        canPostconfidentialOpportunities: firestoreUserData?.canPostconfidentialOpportunities || false,
        canViewconfidentialOpportunities: firestoreUserData?.canViewconfidentialOpportunities || false,
        postedopportunities: firestoreUserData?.postedopportunities ? safeJsonParse(firestoreUserData.postedopportunities, []) : [],
        savedopportunities: firestoreUserData?.savedopportunities ? safeJsonParse(firestoreUserData.savedopportunities, []) : [],
        nonce: firestoreUserData?.nonce || null,
        nonceExpires: firestoreUserData?.nonceExpires || null,
        settings: firestoreUserData?.settings ? safeJsonParse(firestoreUserData.settings, {
          language: 'en',
          theme: 'system',
          notifications: true,
          notificationPreferences: { email: true, inApp: true, sms: false }
        }) : {
          language: 'en',
          theme: 'system',
          notifications: true,
          notificationPreferences: { email: true, inApp: true, sms: false }
        },
        notificationPreferences: firestoreUserData?.notificationPreferences ? safeJsonParse(firestoreUserData.notificationPreferences, {
          email: true,
          inApp: true,
          sms: false
        }) : {
          email: true,
          inApp: true,
          sms: false
        },
        kycVerification: firestoreUserData?.kycVerification ? safeJsonParse(firestoreUserData.kycVerification, null) : null,
        pendingUpgradeRequest: firestoreUserData?.pendingUpgradeRequest ? safeJsonParse(firestoreUserData.pendingUpgradeRequest, null) : null,
        photoURL: firestoreUserData?.photoURL || betterAuthUser.image || null,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      accessToken: 'placeholder-token' // TODO: Implement proper token from BetterAuth
    }
    
    return {
      data: sessionData,
      status: 'authenticated' as const,
      user: sessionData.user,
      update: async (data?: any) => {
        console.warn('Session update not implemented in BetterAuth:', data)
        // TODO: Implement session refresh with BetterAuth
        if (betterAuthSession?.refetch) {
          betterAuthSession.refetch()
        }
      }
    }
  }, [betterAuthSession])
  
  return transformedSession
} 