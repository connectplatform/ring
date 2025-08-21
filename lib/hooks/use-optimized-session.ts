/**
 * Optimized Session Hook
 * Provides intelligent session management with reduced API calls
 */

'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { AuthUser, UserRole } from '@/features/auth/types'

interface OptimizedSessionOptions {
  /**
   * How often to check session validity (in milliseconds)
   * Default: 10 minutes
   */
  checkInterval?: number
  
  /**
   * Enable automatic refresh on window focus
   * Default: false (to reduce edge requests)
   */
  refreshOnFocus?: boolean
  
  /**
   * Enable automatic refresh when online
   * Default: false
   */
  refreshOnOnline?: boolean
}

interface OptimizedSessionReturn {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  refreshSession: () => Promise<void>
  lastRefresh: Date | null
}

/**
 * Optimized session hook that reduces unnecessary API calls
 * while maintaining security and user experience
 */
export function useOptimizedSession(options: OptimizedSessionOptions = {}): OptimizedSessionReturn {
  const {
    checkInterval = 10 * 60 * 1000, // 10 minutes default
    refreshOnFocus = false,
    refreshOnOnline = false
  } = options

  const { data: session, status, update } = useSession()
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Track user activity for smart refreshing
  useEffect(() => {
    if (typeof window === 'undefined') return

    const trackActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Only track significant user interactions
    const events = ['click', 'keydown', 'scroll']
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity)
      })
    }
  }, [])

  // Intelligent session refresh - wrapped in useCallback to prevent infinite re-renders
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await update()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }, [update])

  // Smart refresh scheduling
  useEffect(() => {
    if (status !== 'authenticated' || !session) return

    const scheduleNextRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }

      // Calculate dynamic interval based on user activity
      const timeSinceActivity = Date.now() - lastActivityRef.current
      const isUserActive = timeSinceActivity < 5 * 60 * 1000 // 5 minutes

      // Use longer intervals for inactive users
      const dynamicInterval = isUserActive ? checkInterval : checkInterval * 2

      refreshTimeoutRef.current = setTimeout(() => {
        // Only refresh if user has been active recently
        if (isUserActive) {
          refreshSession()
        }
        scheduleNextRefresh() // Schedule next check
      }, dynamicInterval)
    }

    // Initial schedule
    scheduleNextRefresh()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [session, status, checkInterval, refreshSession])

  // Optional: Refresh on window focus (if enabled)
  useEffect(() => {
    if (!refreshOnFocus || typeof window === 'undefined') return

    const handleFocus = () => {
      // Only refresh if it's been a while since last refresh
      if (!lastRefresh || (Date.now() - lastRefresh.getTime()) > 2 * 60 * 1000) {
        refreshSession()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refreshOnFocus, lastRefresh, refreshSession])

  // Optional: Refresh when coming back online (if enabled)
  useEffect(() => {
    if (!refreshOnOnline || typeof window === 'undefined') return

    const handleOnline = () => {
      refreshSession()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshOnOnline, refreshSession])

  // Map to AuthUser format
  const user: AuthUser | null = session?.user ? {
    id: session.user.id || '',
    email: session.user.email || '',
    emailVerified: (session.user as any).emailVerified || null,
    name: session.user.name || null,
    role: (session.user as any).role || UserRole.SUBSCRIBER,
    photoURL: session.user.image || null,
    wallets: [],
    authProvider: (session.user as any).provider || 'credentials',
    authProviderId: session.user.id || '',
    isVerified: (session.user as any).isVerified || false,
    createdAt: new Date((session.user as any).createdAt || Date.now()),
    lastLogin: new Date((session.user as any).lastLogin || Date.now()),
    bio: (session.user as any).bio || '',
    canPostconfidentialOpportunities: false,
    canViewconfidentialOpportunities: false,
    postedopportunities: [],
    savedopportunities: [],
    notificationPreferences: {
      email: true,
      inApp: true,
      sms: false,
    },
    settings: {
      language: 'en',
      theme: 'light',
      notifications: true,
      notificationPreferences: {
        email: true,
        inApp: true,
        sms: false,
      },
    },
    nonce: (session.user as any).nonce,
    nonceExpires: (session.user as any).nonceExpires,
    kycVerification: (session.user as any).kycVerification,
    pendingUpgradeRequest: (session.user as any).pendingUpgradeRequest,
  } : null

  return {
    user,
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated' && !!session?.user,
    refreshSession,
    lastRefresh
  }
}

/**
 * Global session cache for request deduplication
 */
class SessionCache {
  private static instance: SessionCache
  private cache: Map<string, { data: any; timestamp: number; promise?: Promise<any> }> = new Map()
  private readonly TTL = 30000 // 30 seconds TTL for session data

  static getInstance(): SessionCache {
    if (!SessionCache.instance) {
      SessionCache.instance = new SessionCache()
    }
    return SessionCache.instance
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()

    // Return cached data if valid
    if (cached && (now - cached.timestamp) < this.TTL) {
      return cached.data
    }

    // Return existing promise if request is in flight
    if (cached?.promise) {
      return cached.promise
    }

    // Make new request
    const promise = fetcher()
    this.cache.set(key, { data: null, timestamp: now, promise })

    try {
      const data = await promise
      this.cache.set(key, { data, timestamp: now })
      return data
    } catch (error) {
      this.cache.delete(key)
      throw error
    }
  }

  clear(key?: string) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }
}

export const sessionCache = SessionCache.getInstance()
