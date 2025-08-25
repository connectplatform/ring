import { useState, useEffect, use, useMemo } from 'react'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

interface WalletBalanceResponse {
  balance: string
  error?: string
}

interface UseWalletBalanceReturn {
  balance: string | null
  isLoading: boolean
  isError: boolean
  error: string | null
  refetch: () => void
  statusCode?: number
  context?: any
}

interface UseWalletBalancePromiseReturn {
  promise: Promise<string>
  refetch: () => void
}

/**
 * Internal function to fetch wallet balance
 * Enhanced with timeout, retry, and standardized error handling
 */
async function fetchWalletBalance(): Promise<string> {
  try {
    // Use API client with built-in timeout (15s), retry logic, and standardized error handling
    const response: ApiResponse<WalletBalanceResponse> = await apiClient.get('/api/wallet/balance', {
      timeout: 15000, // Extend timeout for blockchain calls
      retries: 2 // Retry twice for network resilience
    })

    if (response.success && response.data) {
      return response.data.balance
    } else {
      throw new Error(response.error || 'Failed to fetch balance')
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      // Enhanced error information from API client
      console.error('Wallet balance fetch failed:', {
        endpoint: '/api/wallet/balance',
        statusCode: err.statusCode,
        message: err.message,
        context: err.context,
        cause: err.cause
      })
      throw new Error(err.message)
    } else {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance'
      console.error('Unexpected error fetching wallet balance:', err)
      throw new Error(errorMessage)
    }
  }
}

/**
 * React 19 Enhanced Hook to fetch wallet balance using use() function
 * Provides both traditional state-based and modern promise-based approaches
 * Enhanced with timeout, retry, and standardized error handling
 */
export function useWalletBalance(enabled: boolean = true): UseWalletBalanceReturn {
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number | undefined>(undefined)
  const [context, setContext] = useState<any>(undefined)

  const fetchBalance = async () => {
    if (!enabled) return

    setIsLoading(true)
    setIsError(false)
    setError(null)
    setStatusCode(undefined)
    setContext(undefined)

    try {
      const balanceResult = await fetchWalletBalance()
      setBalance(balanceResult)
    } catch (err) {
      setIsError(true)
      
      if (err instanceof ApiClientError) {
        // Enhanced error information from API client
        setError(err.message)
        setStatusCode(err.statusCode)
        setContext(err.context)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (enabled) {
      fetchBalance()
    }
  }, [enabled]) // Only depend on enabled to prevent infinite loops

  const refetch = () => {
    fetchBalance()
  }

  return {
    balance,
    isLoading,
    isError,
    error,
    refetch,
    statusCode,
    context
  }
}

/**
 * React 19 Promise-based hook for wallet balance using use() function
 * Returns a promise that can be consumed with React 19's use() function
 * 
 * Usage:
 * ```tsx
 * function WalletDisplay() {
 *   const { promise } = useWalletBalancePromise(true)
 *   const balance = use(promise)
 *   
 *   return <div>Balance: {balance}</div>
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading balance...</div>}>
 *       <WalletDisplay />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useWalletBalancePromise(enabled: boolean = true): UseWalletBalancePromiseReturn {
  const [refreshKey, setRefreshKey] = useState(0)
  
  const promise = useMemo(() => {
    if (!enabled) {
      return Promise.resolve('0')
    }
    
    return fetchWalletBalance()
  }, [enabled, refreshKey])

  const refetch = () => {
    setRefreshKey(prev => prev + 1)
  }

  return {
    promise,
    refetch
  }
}

/**
 * React 19 Enhanced hook that directly uses use() function
 * Suspends the component until the balance is loaded
 * 
 * Usage:
 * ```tsx
 * function WalletDisplay() {
 *   const balance = useWalletBalanceWithSuspense(true)
 *   
 *   return <div>Balance: {balance}</div>
 * }
 * 
 * // Wrap in Suspense boundary
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading balance...</div>}>
 *       <WalletDisplay />
 *     </Suspense>
 *   )
 * }
 * ```
 */
export function useWalletBalanceWithSuspense(enabled: boolean = true): string {
  const { promise } = useWalletBalancePromise(enabled)
  return use(promise)
}

