'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEFAULT_DOCS_AUDIENCE,
  DOCS_AUDIENCE_STORAGE_KEY,
  DOCS_READER_PREFS_STORAGE_KEY,
  type DocsAudience,
  type DocsReaderPrefs,
  isDocsAudience,
} from '@/lib/docs/docs-audience'

// Context value type for consumer access
interface DocsAudienceContextValue {
  audience: DocsAudience // Current documentation audience (e.g. "developer", "end-user", etc)
  setAudience: (audience: DocsAudience) => void // Method to set/update audience, updates state + localStorage
  readerPrefs: DocsReaderPrefs // Dictionary of reader preferences (ex: text size, reader mode)
  setReaderPrefs: (patch: Partial<DocsReaderPrefs>) => void // Patch method for updating readerPrefs
}

// Create the actual context, nullable for optional consumers
const DocsAudienceContext = createContext<DocsAudienceContextValue | null>(null)

// Helper to read the stored audience from localStorage, falling back to default if unavailable/bad
function readStoredAudience(): DocsAudience {
  if (typeof window === 'undefined') return DEFAULT_DOCS_AUDIENCE // Not running in browser: use default
  try {
    const stored = window.localStorage.getItem(DOCS_AUDIENCE_STORAGE_KEY)
    // Accept only valid values, fallback otherwise
    return isDocsAudience(stored) ? stored : DEFAULT_DOCS_AUDIENCE
  } catch {
    // Graceful fallback if localStorage is inaccessible (private mode, quota, etc)
    return DEFAULT_DOCS_AUDIENCE
  }
}

// Helper to read the stored reader preferences from localStorage
function readStoredReaderPrefs(): DocsReaderPrefs {
  if (typeof window === 'undefined') return {} // Not in browser: No prefs
  try {
    const raw = window.localStorage.getItem(DOCS_READER_PREFS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DocsReaderPrefs
  } catch {
    // Graceful fallback if parse fails or inaccessible
    return {}
  }
}

/**
 * Provider: delivers audience and preference state+setters to context consumers.
 * Syncs state to/from localStorage on mount/change.
 */
export function DocsAudienceProvider({ children }: { children: React.ReactNode }) {
  // Local state for current audience
  const [audience, setAudienceState] = useState<DocsAudience>(DEFAULT_DOCS_AUDIENCE)
  // Local state for reader preferences
  const [readerPrefs, setReaderPrefsState] = useState<DocsReaderPrefs>({})

  // On first mount, sync state from localStorage (if in browser)
  useEffect(() => {
    setAudienceState(readStoredAudience())
    setReaderPrefsState(readStoredReaderPrefs())
  }, []) // Empty deps: run only once

  /**
   * Setter for audience, updates local state and attempts localStorage persistence
   */
  const setAudience = useCallback((next: DocsAudience) => {
    setAudienceState(next)
    try {
      window.localStorage.setItem(DOCS_AUDIENCE_STORAGE_KEY, next)
    } catch {
      // ignore quota / private mode errors (localStorage failure)
    }
  }, [])

  /**
   * Setter for reader preferences: merges patch into current readerPrefs and persists
   */
  const setReaderPrefs = useCallback((patch: Partial<DocsReaderPrefs>) => {
    setReaderPrefsState((prev) => {
      const merged = { ...prev, ...patch }
      try {
        window.localStorage.setItem(DOCS_READER_PREFS_STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // gracefully ignore (localStorage quota, private mode etc)
      }
      return merged
    })
  }, [])

  // Memoize the context value for optimal provider re-renders
  const value = useMemo(
    () => ({ audience, setAudience, readerPrefs, setReaderPrefs }),
    [audience, readerPrefs, setAudience, setReaderPrefs],
  )

  // Context provider: passes value & sets HTML data-* attributes for selectors/theming
  return (
    <DocsAudienceContext.Provider value={value}>
      <div
        data-docs-audience={audience}
        data-docs-text-scale={readerPrefs.textScale ?? 'base'}
        data-docs-reader-mode={readerPrefs.readerMode ? 'true' : 'false'}
        className="contents"
      >
        {children}
      </div>
    </DocsAudienceContext.Provider>
  )

  // TODO: With React 19/Next 16, consider using the `useOptimistic` or `use` hooks to handle async localStorage hydration more natively.
  // TODO: Could consider using `useSyncExternalStore` for better external localStorage sync in future.
}

/**
 * Strict context consumer hook (throws if provider missing).
 * Ensures only called inside <DocsAudienceProvider>.
 */
export function useDocsAudience(): DocsAudienceContextValue {
  const ctx = useContext(DocsAudienceContext)
  if (!ctx) {
    throw new Error('useDocsAudience must be used within DocsAudienceProvider')
  }
  return ctx
}

/**
 * Safe/optional consumer hook (returns null outside the provider).
 */
export function useDocsAudienceOptional(): DocsAudienceContextValue | null {
  return useContext(DocsAudienceContext)
}
