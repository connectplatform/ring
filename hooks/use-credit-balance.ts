'use client'

import { useState, useEffect, useCallback, use, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'
import { useTunnelSubscription } from './use-tunnel-subscription'

interface CreditBalanceData {
  balance: {
    amount: string
    usd_equivalent: string
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
 * Hook for managing user's RING credit balance
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

  // Stable callback for tunnel messages - uses ref pattern to avoid re-subscriptions
  const handleTunnelMessage = useCallback((newData: CreditBalanceData) => {
    setData(newData)
    setLastRefreshed(Date.now())
    logger.info('Credit balance updated via tunnel', {
      amount: newData.balance.amount,
      subscriptionActive: newData.subscription.active
    })
  }, [])

  // Subscribe to tunnel for real-time balance updates
  // Note: onMessage is now a stable reference to prevent re-subscription loops
  const {
    data: tunnelData,
    isConnected: isTunnelConnected,
    error: tunnelError
  } = useTunnelSubscription<CreditBalanceData>({
    channel: 'credit:balance',
    enabled: status === 'authenticated' && !!session?.user,
    onMessage: handleTunnelMessage
  })

  // Update data when tunnel pushes updates
  useEffect(() => {
    if (tunnelData) {
      setData(tunnelData)
      setLastRefreshed(Date.now())
    }
  }, [tunnelData])

  const fetchBalance = useCallback(async (isRefresh = false) => {
    // Only fetch if user is authenticated
    if (status !== 'authenticated' || !session?.user) {
      logger.debug('Skipping balance fetch - user not authenticated', { status, hasSession: !!session })
      return
    }

    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setError(null)

      // Use API client with wallet domain configuration (15s timeout, 2 retries)
      const response: ApiResponse<CreditBalanceData> = await apiClient.get('/api/wallet/credit/balance', {
        timeout: 15000, // 15 second timeout for wallet operations
        retries: 2 // Retry twice for network resilience
      })

      if (response.success && response.data) {
        setData(response.data)
        setLastRefreshed(Date.now())

        logger.info('Credit balance fetched via API', {
          amount: response.data.balance.amount,
          subscriptionActive: response.data.subscription.active,
          isRefresh,
          tunnelConnected: isTunnelConnected
        })
      } else {
        throw new Error(response.error || 'Failed to fetch balance')
      }

    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
        
        // Log with structured context
        logger.error('Credit balance fetch failed:', {
          endpoint: '/api/wallet/credit/balance',
          statusCode: err.statusCode,
          message: err.message,
          context: err.context,
          cause: err.cause,
          isRefresh
        })
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        
        logger.error('Unexpected error fetching credit balance', { error: err, isRefresh })
      }
      
      // Don't clear data on refresh errors, keep showing stale data
      if (!isRefresh) {
        setData(null)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [isTunnelConnected, session?.user, status])

  const refresh = useCallback(async () => {
    await fetchBalance(true)
  }, [fetchBalance])

  // Initial load - only when authenticated (ONE TIME)
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !initialFetchDone.current) {
      initialFetchDone.current = true
      fetchBalance()
    } else if (status === 'unauthenticated') {
      // Reset data when user becomes unauthenticated
      setData(null)
      setError(null)
      setLastRefreshed(null)
      initialFetchDone.current = false
    }
  }, [fetchBalance, status, session?.user])

  // FALLBACK: Only poll if tunnel is NOT connected (every 60s instead of 30s)
  useEffect(() => {
    // Skip polling if tunnel is connected - tunnel will push updates
    if (isTunnelConnected) {
      logger.debug('Tunnel connected - polling disabled')
      return
    }

    if (!data || status !== 'authenticated' || !session?.user) return

    logger.debug('Tunnel not connected - falling back to polling')
    
    const interval = setInterval(() => {
      fetchBalance(true)
    }, 60000) // 60 seconds fallback polling (was 30s)

    return () => clearInterval(interval)
  }, [data, fetchBalance, isTunnelConnected, status, session?.user])

  return {
    balance: data?.balance || null,
    subscription: data?.subscription || null,
    limits: data?.limits || null,
    isLoading,
    isRefreshing,
    error: error || tunnelError,
    refresh,
    lastRefreshed,
    isTunnelConnected
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
