'use client'

/**
 * Owner hook for wallet credit transaction history (GET /api/wallet/credit/history).
 * UI consumers must use useCreditHistoryContext() from CreditHistoryProvider.
 * Pagination SSOT: useCursorFeed (moduleId: wallet).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { CreditHistoryResponse, CreditTransaction } from '@/lib/zod/credit-schemas'
import { logger } from '@/lib/logger'
import { useCursorFeed } from '@/hooks/use-cursor-feed'
import { buildFilterFingerprint } from '@/lib/pagination/filter-fingerprint'
import { normalizePaginatedResponse } from '@/lib/pagination/normalize-paginated-response'

/** Stable empty seed — inline `[]` recreates identity every render and churns reset(). */
const EMPTY_CREDIT_TRANSACTIONS: CreditTransaction[] = []

interface UseCreditHistoryOptions {
  limit?: number
  enabled?: boolean
}

interface UseCreditHistoryReturn {
  transactions: CreditTransaction[]
  hasMore: boolean
  nextCursor: string | undefined
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

export function useCreditHistory({
  limit = 50,
  enabled = true,
}: UseCreditHistoryOptions = {}): UseCreditHistoryReturn {
  const { data: session, status } = useSession()
  const locale = useLocale()
  const authenticated = status === 'authenticated' && Boolean(session?.user)
  const feedEnabled = enabled && authenticated

  const filterFingerprint = useMemo(
    () => buildFilterFingerprint('wallet', { scope: 'credit', limit }),
    [limit],
  )

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const safeLimit = Number.isFinite(limit) && limit >= 1 && limit <= 100 ? limit : 50
      const params = new URLSearchParams({ limit: String(safeLimit) })
      if (cursor) params.set('after_id', cursor)

      const response = await apiClient.get<CreditHistoryResponse>(
        `/api/wallet/credit/history?${params.toString()}`,
        { timeout: 15000, retries: 0 },
      )

      if (!response.success || !response.data) {
        const message = response.error || 'Failed to fetch credit history'
        logger.error('Credit history fetch failed', {
          message,
          endpoint: '/api/wallet/credit/history',
        })
        throw new Error(message)
      }

      const data = response.data
      return normalizePaginatedResponse<CreditTransaction>(
        {
          transactions: data.transactions,
          items: data.transactions,
          has_more: data.has_more,
          next_cursor: data.next_cursor,
          cursor: data.next_cursor,
        },
        safeLimit,
      )
    },
    [limit],
  )

  const {
    items: transactions,
    loading: isLoading,
    hasMore,
    error,
    reload,
    reset,
  } = useCursorFeed<CreditTransaction>({
    moduleId: 'wallet',
    locale,
    limit,
    filterFingerprint,
    initialItems: EMPTY_CREDIT_TRANSACTIONS,
    initialCursor: null,
    enabled: feedEnabled,
    fetchPage,
    restoreScroll: false,
  })

  const refresh = useCallback(async () => {
    try {
      await reload()
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to fetch credit history'
      logger.error('Credit history refresh failed', { message })
    }
  }, [reload])

  const loadMore = useCallback(async () => {
    // Sentinel-driven by useCursorFeed; keep API for callers that invoke loadMore
    if (!hasMore) return
  }, [hasMore])

  // Clear feed only on true→false transition (logout / disable). Do not depend on
  // reset identity — callers that pass a fresh initialItems[] would otherwise loop.
  const wasFeedEnabled = useRef(feedEnabled)
  useEffect(() => {
    const previouslyEnabled = wasFeedEnabled.current
    wasFeedEnabled.current = feedEnabled
    if (previouslyEnabled && !feedEnabled) {
      reset()
    }
  }, [feedEnabled, reset])

  return {
    transactions,
    hasMore,
    nextCursor: hasMore && transactions.length > 0 ? transactions[transactions.length - 1]?.id : undefined,
    isLoading,
    isRefreshing: isLoading && transactions.length > 0,
    error,
    refresh,
    loadMore,
  }
}
