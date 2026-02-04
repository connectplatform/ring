/**
 * Client-side session cache hook
 * Reduces redundant API calls by caching session data
 */

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 50

interface SessionCache {
  session: any
  timestamp: number
  expires: number
}

class SessionCacheManager {
  private cache = new Map<string, SessionCache>()
  private cacheOrder: string[] = []

  get(key: string): SessionCache | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expires) {
      return cached
    }
    // Remove expired entry
    if (cached) {
      this.cache.delete(key)
      const index = this.cacheOrder.indexOf(key)
      if (index > -1) {
        this.cacheOrder.splice(index, 1)
      }
    }
    return null
  }

  set(key: string, session: any): void {
    const now = Date.now()
    const cacheEntry: SessionCache = {
      session,
      timestamp: now,
      expires: now + CACHE_TTL
    }

    // Remove oldest entries if cache is full
    while (this.cacheOrder.length >= MAX_CACHE_SIZE) {
      const oldestKey = this.cacheOrder.shift()
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, cacheEntry)
    this.cacheOrder.push(key)
  }

  clear(): void {
    this.cache.clear()
    this.cacheOrder = []
  }

  size(): number {
    return this.cache.size
  }
}

const sessionCache = new SessionCacheManager()

/**
 * Hook that provides cached session data to reduce API calls
 * Falls back to standard useSession when cache misses
 */
export function useCachedSession() {
  const { data: session, status, update } = useSession()
  const cacheKey = useRef<string>('')

  // Generate cache key based on session state
  useEffect(() => {
    const userId = session?.user?.id || 'anonymous'
    const sessionToken = (session as any)?.accessToken?.slice(0, 16) || 'no-token'
    cacheKey.current = `${userId}-${sessionToken}`
  }, [session])

  // Cache session data when available
  useEffect(() => {
    if (session && status === 'authenticated') {
      sessionCache.set(cacheKey.current, session)

      // Log cache hit ratio in development
      if (process.env.NODE_ENV === 'development' && sessionCache.size() > 0) {
        console.log(`Session cache: ${sessionCache.size()} entries cached`)
      }
    }
  }, [session, status, cacheKey])

  // Check cache on mount
  const cachedSession = sessionCache.get(cacheKey.current)

  // Return cached data if available and fresh, otherwise use live session
  if (cachedSession && status === 'loading') {
    return {
      data: cachedSession.session,
      status: 'authenticated' as const,
      update,
      isCached: true
    }
  }

  return {
    data: session,
    status,
    update,
    isCached: false
  }
}

/**
 * Clear session cache (useful for logout)
 */
export function clearSessionCache() {
  sessionCache.clear()
}
