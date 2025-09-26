'use client'

import { useState, useEffect, useCallback, use, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { logger } from '@/lib/logger'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

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
}

interface UseCreditBalancePromiseReturn {
  promise: Promise<CreditBalanceData>
  refresh: () => void
}

/**
 * Hook for managing user's RING credit balance
 */
export function useCreditBalance(): UseCreditBalanceReturn {
  const { data: session, status } = useSession()
  const [data, setData] = useState<CreditBalanceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

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

        logger.info('Credit balance fetched', {
          amount: response.data.balance.amount,
          subscriptionActive: response.data.subscription.active,
          isRefresh
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
  }, [])

  const refresh = useCallback(async () => {
    await fetchBalance(true)
  }, [fetchBalance])

  // Initial load - only when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchBalance()
    } else {
      // Reset data when user becomes unauthenticated
      setData(null)
      setError(null)
      setLastRefreshed(null)
    }
  }, [fetchBalance, status, session?.user])

  // Auto-refresh every 30 seconds for balance updates - only when authenticated
  useEffect(() => {
    if (!data || status !== 'authenticated' || !session?.user) return

    const interval = setInterval(() => {
      fetchBalance(true)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [data, fetchBalance, status, session?.user])

  return {
    balance: data?.balance || null,
    subscription: data?.subscription || null,
    limits: data?.limits || null,
    isLoading,
    isRefreshing,
    error,
    refresh,
    lastRefreshed,
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
