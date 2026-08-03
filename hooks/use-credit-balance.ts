'use client'

import { useState, useEffect, useCallback, use, useMemo, useRef, useEffectEvent } from 'react'
import { useSession } from 'next-auth/react'
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
import { useTunnelChannel } from './use-tunnel-channel'

interface CreditBalanceData {
  balance: {
    amount: string
    main_currency_equivalent: string
    last_updated: number
  }
  subscription: {
    active: boolean
    contract_address?: string
    next_payment?: number
    status?: 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED'
  }
  limits: {
    monthly_spend_limit: string
    remaining_monthly_limit: string
    min_balance_warning: string
  }
}

interface UseCreditBalanceReturn {
  balance: CreditBalanceData['balance'] | null
  subscription: CreditBalanceData['subscription'] | null
  limits: CreditBalanceData['limits'] | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  lastRefreshed: number | null
  // Tunnel status
  isTunnelConnected: boolean
}

interface UseCreditBalancePromiseReturn {
  promise: Promise<CreditBalanceData>
  refresh: () => void
}

/**
 * Module-scope single-flight + short TTL cache for the *initial bootstrap* fetch only.
 * `CreditBalanceProvider` is the sole owner per `hooks/HOOKS-README.md` Provider matrix,
 * but its Suspense boundary + React Strict Mode can still remount `useCreditBalance`
 * with a fresh `initialFetchDone` ref in dev, producing 2-3x duplicate
 * `GET /api/wallet/credit/balance` calls. This guard lives outside any component
 * instance, so it survives ref resets. Mirrors `initializeDatabaseInFlight` in
 * `lib/database/DatabaseService.ts` and the TTL pattern in `hooks/use-vendor-status.ts`.
 * Manual `refresh()` always bypasses this and hits the network directly.
 *
 * Keyed by `userId` (not a bare module singleton) — a same-tab user switch
 * (logout then a different account logs in within the TTL window) must never
 * serve the previous user's cached balance to the next session.
 */
const BOOTSTRAP_CACHE_TTL_MS = 5_000
let bootstrapInFlight: Promise<CreditBalanceData> | null = null
let bootstrapInFlightUserId: string | null = null
let bootstrapCachedAt = 0
let bootstrapCachedUserId: string | null = null
let bootstrapCachedData: CreditBalanceData | null = null

function fetchCreditBalanceBootstrap(userId: string): Promise<CreditBalanceData> {
  const now = Date.now()
  if (
    bootstrapCachedUserId === userId &&
    bootstrapCachedData &&
    now - bootstrapCachedAt < BOOTSTRAP_CACHE_TTL_MS
  ) {
    return Promise.resolve(bootstrapCachedData)
  }
  if (bootstrapInFlight && bootstrapInFlightUserId === userId) {
    return bootstrapInFlight
  }

  bootstrapInFlightUserId = userId
  bootstrapInFlight = fetchCreditBalance()
    .then((result) => {
      bootstrapCachedData = result
      bootstrapCachedUserId = userId
      bootstrapCachedAt = Date.now()
      return result
    })
    .finally(() => {
      bootstrapInFlight = null
      bootstrapInFlightUserId = null
    })

  return bootstrapInFlight
}

/**
 * Hook for managing user's credit balance
 * 
 * OPTIMIZED: Uses Tunnel push updates instead of polling
 * - Initial fetch via API (one-time)
 * - Subsequent updates pushed via Tunnel (real-time)
 * - Fallback to polling only if tunnel unavailable
 * 
 * @see AI-CONTEXT: tunnel-protocol-firebase-rtdb-analog-2025-11-07
 */
export function useCreditBalance(): UseCreditBalanceReturn {
  const { data: session, status } = useSession()
  const [data, setData] = useState<CreditBalanceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)
  const initialFetchDone = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const statusRef = useRef(status)
  statusRef.current = status

  // React 19.2: useEffectEvent keeps tunnel handler fresh without re-subscribe churn
  const onTunnelMessage = useEffectEvent((newData: CreditBalanceData) => {
    setData(newData)
    setLastRefreshed(Date.now())
    logger.info('Credit balance updated via tunnel', {
      amount: newData.balance.amount,
      subscriptionActive: newData.subscription.active,
    })
  })

  const { isConnected: isTunnelConnected, error: tunnelError } = useTunnelChannel<CreditBalanceData>({
    channel: 'credit:balance',
    userScoped: false,
    enabled: status === 'authenticated' && !!session?.user,
    onMessage: onTunnelMessage,
  })

  const fetchBalance = useCallback(async (isRefresh = false) => {
    if (statusRef.current !== 'authenticated' || !sessionRef.current?.user) {
      logger.debug('Skipping balance fetch - user not authenticated', {
        status: statusRef.current,
        hasSession: !!sessionRef.current,
      })
      return
    }

    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setError(null)

      const response: ApiResponse<CreditBalanceData> = await apiClient.get('/api/wallet/credit/balance', {
        timeout: 15000,
        retries: 2,
      })

      if (response.success && response.data) {
        setData(response.data)
        setLastRefreshed(Date.now())

        logger.info('Credit balance fetched via API', {
          amount: response.data.balance.amount,
          subscriptionActive: response.data.subscription.active,
          isRefresh,
        })
      } else {
        throw new Error(response.error || 'Failed to fetch balance')
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
        logger.error('Credit balance fetch failed:', {
          endpoint: '/api/wallet/credit/balance',
          statusCode: err.statusCode,
          message: err.message,
          context: err.context,
          cause: err.cause,
          isRefresh,
        })
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        logger.error('Unexpected error fetching credit balance', { error: err, isRefresh })
      }

      if (!isRefresh) {
        setData(null)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchBalance(true)
  }, [fetchBalance])

  // Initial load - only when authenticated (ONE TIME per instance; module-scope
  // single-flight in fetchCreditBalanceBootstrap dedupes across remounts too)
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && !initialFetchDone.current) {
      initialFetchDone.current = true
      setIsLoading(true)
      setError(null)
      fetchCreditBalanceBootstrap(session.user.id)
        .then((result) => {
          setData(result)
          setLastRefreshed(Date.now())
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setData(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else if (status === 'unauthenticated') {
      setData(null)
      setError(null)
      setLastRefreshed(null)
      initialFetchDone.current = false
    }
  }, [status, session?.user?.id])

  // FALLBACK: Only poll if tunnel is NOT connected
  useEffect(() => {
    if (isTunnelConnected) {
      logger.debug('Tunnel connected - polling disabled')
      return
    }

    if (!data || status !== 'authenticated' || !session?.user) return

    logger.debug('Tunnel not connected - falling back to polling')

    const interval = setInterval(() => {
      void fetchBalance(true)
    }, 60000)

    return () => clearInterval(interval)
  }, [data, fetchBalance, isTunnelConnected, status, session?.user])

  return {
    balance: data?.balance || null,
    subscription: data?.subscription || null,
    limits: data?.limits || null,
    isLoading,
    isRefreshing,
    error: error ?? (data ? null : tunnelError),
    refresh,
    lastRefreshed,
    isTunnelConnected,
  }
}

/**
 * Internal function to fetch credit balance
 * Enhanced with timeout, retry, and standardized error handling
 */
async function fetchCreditBalance(): Promise<CreditBalanceData> {
  try {
    // Use API client with wallet domain configuration (15s timeout, 2 retries)
    const response: ApiResponse<CreditBalanceData> = await apiClient.get('/api/wallet/credit/balance', {
      timeout: 15000, // 15 second timeout for wallet operations
      retries: 2 // Retry twice for network resilience
    })

    if (response.success && response.data) {
      logger.info('Credit balance fetched', {
        amount: response.data.balance.amount,
        subscriptionActive: response.data.subscription.active
      })
      return response.data
    } else {
      throw new Error(response.error || 'Failed to fetch balance')
    }
  } catch (err) {
    // Handle authentication errors gracefully
    if (err instanceof ApiClientError && err.statusCode === 401) {
      logger.debug('Credit balance fetch failed due to authentication', {
        statusCode: err.statusCode,
        message: err.message
      })
      throw new Error('Authentication required')
    }
    if (err instanceof ApiClientError) {
      // Log with structured context
      logger.error('Credit balance fetch failed:', {
        endpoint: '/api/wallet/credit/balance',
        statusCode: err.statusCode,
        message: err.message,
        context: err.context,
        cause: err.cause
      })
      throw new Error(err.message)
    } else {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Unexpected error fetching credit balance', { error: err })
      throw new Error(errorMessage)
    }
  }
}

/**
 * React 19 Promise-based hook for credit balance using use() function
 * Returns a promise that can be consumed with React 19's use() function
 * 
 * Usage:
 * ```tsx
 * function CreditDisplay() {
 *   const { promise } = useCreditBalancePromise()
 *   const creditData = use(promise)
 *   
 *   return <div>Balance: {creditData.balance.amount}</div>
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading credit balance...</div>}>
 *       <CreditDisplay />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useCreditBalancePromise(): UseCreditBalancePromiseReturn {
  const [refreshKey, setRefreshKey] = useState(0)
  
  const promise = useMemo(() => {
    return fetchCreditBalance()
  }, [refreshKey])

  const refresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return {
    promise,
    refresh
  }
}

/**
 * React 19 Enhanced hook that directly uses use() function
 * Suspends the component until the credit balance is loaded
 * 
 * Usage:
 * ```tsx
 * function CreditDisplay() {
 *   const creditData = useCreditBalanceWithSuspense()
 *   
 *   return <div>Balance: {creditData.balance.amount}</div>
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading credit balance...</div>}>
 *       <CreditDisplay />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useCreditBalanceWithSuspense(): CreditBalanceData {
  const { promise } = useCreditBalancePromise()
  return use(promise)
}
