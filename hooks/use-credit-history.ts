'use client'

/**
 * Owner hook for wallet credit transaction history (GET /api/wallet/credit/history).
 * UI consumers must use useCreditHistoryContext() from CreditHistoryProvider.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { CreditHistoryResponse, CreditTransaction } from '@/lib/zod/credit-schemas'
import { logger } from '@/lib/logger'

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

function normalizeNextCursor(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function useCreditHistory({
  limit = 50,
  enabled = true,
}: UseCreditHistoryOptions = {}): UseCreditHistoryReturn {
  const { data: session, status } = useSession()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialFetchDone = useRef(false)
  const requestIdRef = useRef(0)

  const fetchHistory = useCallback(
    async (opts: { afterId?: string; append?: boolean; isRefresh?: boolean }) => {
      if (status !== 'authenticated' || !session?.user || !enabled) return

      const requestId = ++requestIdRef.current

      try {
        if (opts.isRefresh) {
          setIsRefreshing(true)
        } else if (!opts.append) {
          setIsLoading(true)
        }
        setError(null)

        const safeLimit = Number.isFinite(limit) && limit >= 1 && limit <= 100 ? limit : 50
        const params = new URLSearchParams({ limit: String(safeLimit) })
        if (opts.afterId) params.set('after_id', opts.afterId)

        const response = await apiClient.get<CreditHistoryResponse>(
          `/api/wallet/credit/history?${params.toString()}`,
          { timeout: 15000, retries: 0 },
        )

        if (requestId !== requestIdRef.current) return

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to fetch credit history')
        }

        const data = response.data
        setTransactions((prev) =>
          opts.append ? [...prev, ...data.transactions] : data.transactions,
        )
        setHasMore(Boolean(data.has_more))
        setNextCursor(normalizeNextCursor(data.next_cursor))
      } catch (err) {
        if (requestId !== requestIdRef.current) return

        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to fetch credit history'

        setError(message)
        logger.error('Credit history fetch failed', {
          message,
          statusCode: err instanceof ApiClientError ? err.statusCode : undefined,
          endpoint: '/api/wallet/credit/history',
        })
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [enabled, limit, session?.user, status],
  )

  const refresh = useCallback(async () => {
    await fetchHistory({ isRefresh: true })
  }, [fetchHistory])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor) return
    await fetchHistory({ afterId: nextCursor, append: true })
  }, [fetchHistory, hasMore, nextCursor])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || !enabled) return
    if (initialFetchDone.current) return
    initialFetchDone.current = true
    void fetchHistory({}).catch(() => {
      /* handled in fetchHistory — swallow to avoid global promise_rejection telemetry */
    })
  }, [enabled, fetchHistory, session?.user, status])

  return {
    transactions,
    hasMore,
    nextCursor,
    isLoading,
    isRefreshing,
    error,
    refresh,
    loadMore,
  }
}
