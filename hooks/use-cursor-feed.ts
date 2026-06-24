'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { useInView } from '@/hooks/use-intersection-observer'
import {
  mergeUniqueById,
  resolveNextClientCursor,
  shouldTriggerInfiniteScroll,
} from '@/lib/pagination/cursor-pagination'
import { clearFeedSession, readFeedSession, writeFeedSession } from '@/lib/pagination/feed-session'
import { FEED_SESSION_VERSION } from '@/lib/pagination/types'
import type { CursorFeedModuleId, PaginatedListResponse } from '@/lib/pagination/types'

export interface UseCursorFeedOptions<T extends { id: string }> {
  moduleId: CursorFeedModuleId
  locale: string
  limit: number
  filterFingerprint: string
  initialItems: T[]
  initialCursor: string | null
  enabled?: boolean
  fetchPage: (cursor: string | null) => Promise<PaginatedListResponse<T>>
  maxCachedItems?: number
  /** Called after each successful page with newly added rows */
  onItemsAdded?: (added: T[]) => void
  /** Restore window scrollY from session (default true) */
  restoreScroll?: boolean
  scrollContainerRef?: RefObject<HTMLElement | null>
}

export interface UseCursorFeedResult<T extends { id: string }> {
  items: T[]
  setItems: React.Dispatch<React.SetStateAction<T[]>>
  loading: boolean
  hasMore: boolean
  error: string | null
  sentinelRef: (node: Element | null) => void
  reload: () => Promise<void>
  reset: () => void
}

const SCROLL_SAVE_DEBOUNCE_MS = 200

export function useCursorFeed<T extends { id: string }>({
  moduleId,
  locale,
  limit,
  filterFingerprint,
  initialItems,
  initialCursor,
  enabled = true,
  fetchPage,
  maxCachedItems = 120,
  onItemsAdded,
  restoreScroll = true,
  scrollContainerRef,
}: UseCursorFeedOptions<T>): UseCursorFeedResult<T> {
  const hydratedRef = useRef(false)
  const inFlightRef = useRef(false)
  const lastFingerprintRef = useRef(filterFingerprint)
  const needsInitialFetchRef = useRef(false)
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [items, setItems] = useState<T[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = useState(Boolean(initialCursor))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { ref: sentinelRef, inView } = useInView({
    rootMargin: '200px',
    skip: !hasMore || !enabled,
  })

  const persistSession = useCallback(
    (nextItems: T[], nextCursor: string | null, nextHasMore: boolean, scrollY: number) => {
      const capped = nextItems.slice(0, maxCachedItems)
      writeFeedSession(moduleId, locale, {
        version: FEED_SESSION_VERSION,
        filterFingerprint,
        cursor: nextCursor,
        hasMore: nextHasMore,
        items: capped,
        scrollY,
        timestamp: Date.now(),
      })
    },
    [filterFingerprint, locale, maxCachedItems, moduleId],
  )

  const getScrollY = useCallback(() => {
    if (scrollContainerRef?.current) {
      return scrollContainerRef.current.scrollTop
    }
    return typeof window !== 'undefined' ? window.scrollY : 0
  }, [scrollContainerRef])

  const restoreScrollPosition = useCallback(
    (scrollY: number) => {
      if (!restoreScroll || scrollY <= 0) return
      requestAnimationFrame(() => {
        if (scrollContainerRef?.current) {
          scrollContainerRef.current.scrollTop = scrollY
        } else {
          window.scrollTo({ top: scrollY, behavior: 'auto' })
        }
      })
    },
    [restoreScroll, scrollContainerRef],
  )

  // Hydrate from localStorage once per mount / matching fingerprint
  useEffect(() => {
    if (!enabled || hydratedRef.current) return
    hydratedRef.current = true

    const saved = readFeedSession<T>(moduleId, locale, filterFingerprint)
    if (saved && saved.items.length > 0) {
      setItems(saved.items)
      setCursor(saved.cursor)
      setHasMore(saved.hasMore)
      restoreScrollPosition(saved.scrollY)
      return
    }

    setItems(initialItems)
    setCursor(initialCursor)
    setHasMore(initialItems.length > 0 ? Boolean(initialCursor) : true)
    needsInitialFetchRef.current = initialItems.length === 0
  }, [
    enabled,
    filterFingerprint,
    initialCursor,
    initialItems,
    locale,
    moduleId,
    restoreScrollPosition,
  ])

  // Filter change → reset feed + clear storage
  useEffect(() => {
    if (lastFingerprintRef.current === filterFingerprint) return
    lastFingerprintRef.current = filterFingerprint
    clearFeedSession(moduleId, locale)
    setItems(initialItems)
    setCursor(initialCursor)
    setHasMore(initialItems.length > 0 ? Boolean(initialCursor) : true)
    setError(null)
    hydratedRef.current = true
    needsInitialFetchRef.current = initialItems.length === 0
  }, [filterFingerprint, initialCursor, initialItems, locale, moduleId])

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!enabled || inFlightRef.current) return
      if (!reset && (!hasMore || !cursor)) return

      inFlightRef.current = true
      setLoading(true)
      setError(null)

      const requestCursor = reset ? null : cursor

      try {
        const page = await fetchPage(requestCursor)
        const fetched = page.items ?? []

        const base = reset ? [] : items
        const { merged, added } = mergeUniqueById(base, fetched)

        const nextCursor = reset
          ? page.hasMore
            ? page.cursor
            : null
          : resolveNextClientCursor({
              previousCursor: requestCursor,
              apiCursor: page.cursor,
              addedCount: added.length,
              fetchedCount: fetched.length,
            })

        const nextHasMore = nextCursor !== null && (page.hasMore ?? Boolean(nextCursor))

        setItems(merged)
        setCursor(nextCursor)
        setHasMore(nextHasMore)

        if (added.length > 0) {
          onItemsAdded?.(added)
        }

        persistSession(merged, nextCursor, nextHasMore, getScrollY())
      } catch (err) {
        console.error(`[useCursorFeed:${moduleId}] load error`, err)
        setError(err instanceof Error ? err.message : 'Failed to load feed')
        setHasMore(false)
        setCursor(null)
      } finally {
        setLoading(false)
        inFlightRef.current = false
      }
    },
    [
      cursor,
      enabled,
      fetchPage,
      getScrollY,
      hasMore,
      items,
      moduleId,
      onItemsAdded,
      persistSession,
    ],
  )

  const reload = useCallback(async () => {
    clearFeedSession(moduleId, locale)
    setHasMore(true)
    setCursor(null)
    await loadPage(true)
  }, [loadPage, locale, moduleId])

  const reset = useCallback(() => {
    clearFeedSession(moduleId, locale)
    setItems(initialItems)
    setCursor(initialCursor)
    setHasMore(Boolean(initialCursor))
    setError(null)
  }, [initialCursor, initialItems, locale, moduleId])

  // First page when feed is empty (store, filter reset, no saved session)
  useEffect(() => {
    if (!enabled || !hydratedRef.current || !needsInitialFetchRef.current) return
    if (items.length > 0 || loading || inFlightRef.current) return
    needsInitialFetchRef.current = false
    void loadPage(true)
  }, [enabled, items.length, loadPage, loading])

  // Infinite scroll trigger
  useEffect(() => {
    if (shouldTriggerInfiniteScroll({ inView, loading, hasMore: hasMore && enabled })) {
      void loadPage(false)
    }
  }, [enabled, hasMore, inView, loadPage, loading])

  // Persist scroll position
  useEffect(() => {
    if (!enabled) return

    const saveScroll = () => {
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current)
      scrollSaveTimerRef.current = setTimeout(() => {
        persistSession(items, cursor, hasMore, getScrollY())
      }, SCROLL_SAVE_DEBOUNCE_MS)
    }

    const target = scrollContainerRef?.current ?? window
    target.addEventListener('scroll', saveScroll, { passive: true })
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveScroll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', saveScroll)

    return () => {
      target.removeEventListener('scroll', saveScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', saveScroll)
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current)
    }
  }, [cursor, enabled, getScrollY, hasMore, items, persistSession, scrollContainerRef])

  return {
    items,
    setItems,
    loading,
    hasMore,
    error,
    sentinelRef,
    reload,
    reset,
  }
}
