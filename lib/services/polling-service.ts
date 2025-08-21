/**
 * Centralized Polling Service
 * Optimizes API calls by consolidating multiple polling mechanisms into a single, intelligent service
 */

'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface PollConfig {
  endpoint: string
  interval: number // milliseconds
  enabled?: boolean
  onData?: (data: any) => void
  onError?: (error: Error) => void
  priority: 'low' | 'normal' | 'high' | 'critical'
}

interface ActivePoll extends PollConfig {
  id: string
  lastFetch: number
  failures: number
  backoffMultiplier: number
}

class PollingManager {
  private polls: Map<string, ActivePoll> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private requestCache: Map<string, { data: any; timestamp: number; promise?: Promise<any> }> = new Map()
  private isTabActive = true
  private sessionValid = false
  
  // Activity detection for smart polling
  private lastActivity = Date.now()
  private activityThreshold = 30000 // 30 seconds
  
  // Request deduplication cache TTL
  private CACHE_TTL = {
    'notifications': 10000, // 10 seconds
    'session': 60000,       // 1 minute  
    'default': 5000         // 5 seconds
  }

  constructor() {
    this.setupActivityDetection()
    this.setupVisibilityDetection()
  }

  private setupActivityDetection() {
    if (typeof window !== 'undefined') {
      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, () => {
          this.lastActivity = Date.now()
        }, { passive: true })
      })
    }
  }

  private setupVisibilityDetection() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const wasActive = this.isTabActive
        this.isTabActive = !document.hidden
        
        if (!wasActive && this.isTabActive) {
          // Tab became active - trigger immediate refresh for critical polls
          this.refreshCriticalPolls()
        }
      })
    }
  }

  private isUserActive(): boolean {
    return (Date.now() - this.lastActivity) < this.activityThreshold
  }

  private getBackoffInterval(poll: ActivePoll): number {
    // Exponential backoff for failures
    const backoff = Math.min(poll.backoffMultiplier, 8) // Max 8x
    let interval = poll.interval * backoff

    // Reduce polling when tab is inactive
    if (!this.isTabActive) {
      interval *= 2
    }

    // Reduce polling when user is inactive
    if (!this.isUserActive()) {
      interval *= 1.5
    }

    // Reduce polling when session is invalid
    if (!this.sessionValid) {
      interval *= 3
    }

    return interval
  }

  private getCacheKey(endpoint: string): string {
    return endpoint.split('?')[0] // Remove query params for caching
  }

  private isCacheValid(endpoint: string): boolean {
    const cacheKey = this.getCacheKey(endpoint)
    const cached = this.requestCache.get(cacheKey)
    if (!cached) return false

    const ttl = this.CACHE_TTL[cacheKey] || this.CACHE_TTL.default
    return (Date.now() - cached.timestamp) < ttl
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const cacheKey = this.getCacheKey(endpoint)
    
    // Return cached data if valid
    if (this.isCacheValid(endpoint)) {
      return this.requestCache.get(cacheKey)!.data
    }

    // Return existing promise if request is in flight (deduplication)
    const cached = this.requestCache.get(cacheKey)
    if (cached?.promise) {
      return cached.promise
    }

    // Make new request
    const promise = fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(async res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })

    // Cache the promise immediately for deduplication
    this.requestCache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
      promise
    })

    try {
      const data = await promise
      
      // Cache the result
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
      
      return data
    } catch (error) {
      // Remove failed request from cache
      this.requestCache.delete(cacheKey)
      throw error
    }
  }

  private async executePoll(poll: ActivePoll) {
    try {
      const data = await this.makeRequest(poll.endpoint)
      
      // Reset failure count on success
      poll.failures = 0
      poll.backoffMultiplier = 1
      poll.lastFetch = Date.now()

      if (poll.onData) {
        poll.onData(data)
      }
    } catch (error) {
      poll.failures++
      poll.backoffMultiplier = Math.min(poll.backoffMultiplier * 2, 8)
      
      console.warn(`Polling failed for ${poll.endpoint}:`, error)
      
      if (poll.onError) {
        poll.onError(error as Error)
      }
    }

    // Schedule next poll with backoff
    this.scheduleNext(poll)
  }

  private scheduleNext(poll: ActivePoll) {
    // Clear existing timer
    const existingTimer = this.timers.get(poll.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    if (!poll.enabled) return

    const interval = this.getBackoffInterval(poll)
    const timer = setTimeout(() => {
      this.executePoll(poll)
    }, interval)

    this.timers.set(poll.id, timer)
  }

  public addPoll(config: PollConfig): string {
    const id = `${config.endpoint}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const poll: ActivePoll = {
      ...config,
      id,
      lastFetch: 0,
      failures: 0,
      backoffMultiplier: 1
    }

    this.polls.set(id, poll)
    
    if (config.enabled !== false) {
      // Initial fetch after short delay to prevent burst
      setTimeout(() => this.executePoll(poll), 100 + Math.random() * 900)
    }

    return id
  }

  public removePoll(id: string) {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
    
    this.polls.delete(id)
  }

  public updateSession(valid: boolean) {
    this.sessionValid = valid
  }

  public refreshCriticalPolls() {
    this.polls.forEach(poll => {
      if (poll.priority === 'critical' || poll.priority === 'high') {
        // Clear cache for critical polls
        const cacheKey = this.getCacheKey(poll.endpoint)
        this.requestCache.delete(cacheKey)
        
        // Execute immediately
        this.executePoll(poll)
      }
    })
  }

  public clearCache(endpoint?: string) {
    if (endpoint) {
      const cacheKey = this.getCacheKey(endpoint)
      this.requestCache.delete(cacheKey)
    } else {
      this.requestCache.clear()
    }
  }

  public destroy() {
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
    this.polls.clear()
    this.requestCache.clear()
  }
}

// Singleton instance
const pollingManager = new PollingManager()

/**
 * React hook for optimized polling
 */
export function useOptimizedPolling() {
  const { data: session, status } = useSession()
  const pollRefs = useRef<string[]>([])

  useEffect(() => {
    pollingManager.updateSession(status === 'authenticated' && !!session)
  }, [session, status])

  const addPoll = useCallback((config: PollConfig) => {
    const pollId = pollingManager.addPoll(config)
    pollRefs.current.push(pollId)
    return pollId
  }, [])

  const removePoll = useCallback((id: string) => {
    pollingManager.removePoll(id)
    pollRefs.current = pollRefs.current.filter(pollId => pollId !== id)
  }, [])

  const clearCache = useCallback((endpoint?: string) => {
    pollingManager.clearCache(endpoint)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollRefs.current.forEach(id => pollingManager.removePoll(id))
      pollRefs.current = []
    }
  }, [])

  return {
    addPoll,
    removePoll,
    clearCache,
    refreshCritical: () => pollingManager.refreshCriticalPolls()
  }
}

/**
 * Hook for notifications with optimized polling
 */
export function useOptimizedNotifications() {
  const { addPoll, removePoll } = useOptimizedPolling()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const pollIdRef = useRef<string | null>(null)

  useEffect(() => {
    pollIdRef.current = addPoll({
      endpoint: '/api/notifications?unreadOnly=true&limit=1&stats=true',
      interval: 180000, // 3 minutes instead of 2
      priority: 'normal',
      onData: (data) => {
        setUnreadCount(data.unreadCount || 0)
      },
      onError: (error) => {
        console.warn('Notification polling failed:', error)
      }
    })

    return () => {
      if (pollIdRef.current) {
        removePoll(pollIdRef.current)
      }
    }
  }, [addPoll, removePoll])

  return {
    unreadCount,
    notifications,
    refresh: () => {
      // Clear cache and trigger immediate refresh
      pollingManager.clearCache('/api/notifications')
      pollingManager.refreshCriticalPolls()
    }
  }
}

export default pollingManager
