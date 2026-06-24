'use client'

import type {
  CursorFeedModuleId,
  FeedSessionState,
  FeedSessionStorageEnvelope,
} from '@/lib/pagination/types'
import { FEED_SESSION_VERSION } from '@/lib/pagination/types'

const TTL_MS = 24 * 60 * 60 * 1000

function storageDomain(): string {
  if (typeof window === 'undefined') return 'local'
  return process.env.NEXT_PUBLIC_APP_DOMAIN || window.location.hostname || 'local'
}

export function feedSessionStorageKey(moduleId: CursorFeedModuleId, locale: string): string {
  return `ring-feed-${moduleId}-${locale.toLowerCase()}-${storageDomain()}`
}

export function readFeedSession<T>(
  moduleId: CursorFeedModuleId,
  locale: string,
  filterFingerprint: string,
): FeedSessionState<T> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(feedSessionStorageKey(moduleId, locale))
    if (!raw) return null

    const envelope = JSON.parse(raw) as FeedSessionStorageEnvelope<T>
    if (envelope.version !== FEED_SESSION_VERSION) {
      clearFeedSession(moduleId, locale)
      return null
    }

    const { state } = envelope
    if (Date.now() - state.timestamp > TTL_MS) {
      clearFeedSession(moduleId, locale)
      return null
    }

    if (state.filterFingerprint !== filterFingerprint) {
      return null
    }

    return state
  } catch {
    clearFeedSession(moduleId, locale)
    return null
  }
}

export function writeFeedSession<T>(
  moduleId: CursorFeedModuleId,
  locale: string,
  state: FeedSessionState<T>,
): void {
  if (typeof window === 'undefined') return

  try {
    const envelope: FeedSessionStorageEnvelope<T> = {
      version: FEED_SESSION_VERSION,
      moduleId,
      locale,
      state: { ...state, timestamp: Date.now() },
    }
    localStorage.setItem(feedSessionStorageKey(moduleId, locale), JSON.stringify(envelope))
  } catch {
    /* quota / private mode */
  }
}

export function clearFeedSession(moduleId: CursorFeedModuleId, locale: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(feedSessionStorageKey(moduleId, locale))
  } catch {
    /* ignore */
  }
}
