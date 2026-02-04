'use client'

/**
 * User Preferences Hook
 * 
 * Manages user preferences with dual-layer persistence:
 * - localStorage for guest users (immediate, client-side)
 * - Database for authenticated users (persistent, cross-device)
 * 
 * Features:
 * - Auto-sync to DB when user is logged in
 * - Fallback to localStorage for guests
 * - Debounced updates to reduce API calls
 * - Type-safe preferences interface
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface UserPreferences {
  locale: 'en' | 'uk' | 'ru'
  currency: 'UAH' | 'DAAR'
  theme: 'light' | 'dark' | 'system'
}

const DEFAULT_PREFERENCES: UserPreferences = {
  locale: 'uk',
  currency: 'UAH',
  theme: 'system'
}

const STORAGE_KEY = 'ring-user-preferences'
const DEBOUNCE_DELAY = 1000 // 1 second

export function useUserPreferences() {
  const { data: session, status } = useSession()
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true)
      
      try {
        if (status === 'authenticated' && session?.user) {
          // Logged in: Fetch from database
          console.log('🔄 Fetching preferences from database for user:', session.user.id)
          const response = await fetch('/api/users/preferences')
          
          if (response.ok) {
            const data = await response.json()
            const dbPreferences = data.preferences
            console.log('💾 Loaded preferences from database:', dbPreferences)
            setPreferences(dbPreferences)
            // Also save to localStorage for offline access
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dbPreferences))
          } else {
            console.warn('Failed to fetch preferences from database, using localStorage')
            loadFromLocalStorage()
          }
        } else {
          // Guest user: Load from localStorage
          console.log('👤 Guest user, loading preferences from localStorage')
          loadFromLocalStorage()
        }
      } catch (error) {
        console.error('Error loading preferences:', error)
        loadFromLocalStorage()
      } finally {
        setIsLoading(false)
      }
    }

    if (status !== 'loading') {
      loadPreferences()
    }
  }, [status, session])

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedPreferences = JSON.parse(stored)
        console.log('💾 Loaded preferences from localStorage:', parsedPreferences)
        setPreferences(parsedPreferences)
      } else {
        console.log('📝 Using default preferences')
        setPreferences(DEFAULT_PREFERENCES)
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      setPreferences(DEFAULT_PREFERENCES)
    }
  }

  const syncToDatabase = useCallback(async (newPreferences: UserPreferences) => {
    if (status !== 'authenticated' || !session?.user) {
      console.log('👤 Guest user, skipping database sync')
      return
    }

    setIsSyncing(true)
    try {
      console.log('🔄 Syncing preferences to database:', newPreferences)
      const response = await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      })

      if (response.ok) {
        console.log('✅ Preferences synced to database')
      } else {
        console.error('❌ Failed to sync preferences to database')
      }
    } catch (error) {
      console.error('Error syncing preferences to database:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [status, session])

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    const newPreferences = { ...preferences, ...updates }
    setPreferences(newPreferences)

    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences))
    console.log('💾 Saved preferences to localStorage:', newPreferences)

    // Debounce database sync to reduce API calls
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      syncToDatabase(newPreferences)
    }, DEBOUNCE_DELAY)
  }, [preferences, syncToDatabase])

  const setLocale = useCallback((locale: UserPreferences['locale']) => {
    updatePreferences({ locale })
  }, [updatePreferences])

  const setCurrency = useCallback((currency: UserPreferences['currency']) => {
    updatePreferences({ currency })
  }, [updatePreferences])

  const setTheme = useCallback((theme: UserPreferences['theme']) => {
    updatePreferences({ theme })
  }, [updatePreferences])

  return {
    preferences,
    isLoading,
    isSyncing,
    updatePreferences,
    setLocale,
    setCurrency,
    setTheme,
    isAuthenticated: status === 'authenticated'
  }
}

