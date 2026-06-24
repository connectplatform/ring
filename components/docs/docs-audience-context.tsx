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

interface DocsAudienceContextValue {
  audience: DocsAudience
  setAudience: (audience: DocsAudience) => void
  readerPrefs: DocsReaderPrefs
  setReaderPrefs: (patch: Partial<DocsReaderPrefs>) => void
}

const DocsAudienceContext = createContext<DocsAudienceContextValue | null>(null)

function readStoredAudience(): DocsAudience {
  if (typeof window === 'undefined') return DEFAULT_DOCS_AUDIENCE
  try {
    const stored = window.localStorage.getItem(DOCS_AUDIENCE_STORAGE_KEY)
    return isDocsAudience(stored) ? stored : DEFAULT_DOCS_AUDIENCE
  } catch {
    return DEFAULT_DOCS_AUDIENCE
  }
}

function readStoredReaderPrefs(): DocsReaderPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DOCS_READER_PREFS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DocsReaderPrefs
  } catch {
    return {}
  }
}

export function DocsAudienceProvider({ children }: { children: React.ReactNode }) {
  const [audience, setAudienceState] = useState<DocsAudience>(DEFAULT_DOCS_AUDIENCE)
  const [readerPrefs, setReaderPrefsState] = useState<DocsReaderPrefs>({})

  useEffect(() => {
    setAudienceState(readStoredAudience())
    setReaderPrefsState(readStoredReaderPrefs())
  }, [])

  const setAudience = useCallback((next: DocsAudience) => {
    setAudienceState(next)
    try {
      window.localStorage.setItem(DOCS_AUDIENCE_STORAGE_KEY, next)
    } catch {
      // ignore quota / private mode
    }
  }, [])

  const setReaderPrefs = useCallback((patch: Partial<DocsReaderPrefs>) => {
    setReaderPrefsState((prev) => {
      const merged = { ...prev, ...patch }
      try {
        window.localStorage.setItem(DOCS_READER_PREFS_STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // ignore
      }
      return merged
    })
  }, [])

  const value = useMemo(
    () => ({ audience, setAudience, readerPrefs, setReaderPrefs }),
    [audience, readerPrefs, setAudience, setReaderPrefs],
  )

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
}

export function useDocsAudience(): DocsAudienceContextValue {
  const ctx = useContext(DocsAudienceContext)
  if (!ctx) {
    throw new Error('useDocsAudience must be used within DocsAudienceProvider')
  }
  return ctx
}

/** Safe hook for optional provider (returns null outside docs layout). */
export function useDocsAudienceOptional(): DocsAudienceContextValue | null {
  return useContext(DocsAudienceContext)
}
