import { useState, useEffect } from 'react'
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

/**
 * Hook to fetch wallet balance using Ring API Client
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
      // Use API client with built-in timeout (10s), retry logic, and standardized error handling
      const response: ApiResponse<WalletBalanceResponse> = await apiClient.get('/api/wallet/balance', {
        timeout: 15000, // Extend timeout for blockchain calls
        retries: 2 // Retry twice for network resilience
      })

      if (response.success && response.data) {
        setBalance(response.data.balance)
      } else {
        throw new Error(response.error || 'Failed to fetch balance')
      }
    } catch (err) {
      setIsError(true)
      
      if (err instanceof ApiClientError) {
        // Enhanced error information from API client
        setError(err.message)
        setStatusCode(err.statusCode)
        setContext(err.context)
        
        // Log with structured context
        console.error('Wallet balance fetch failed:', {
          endpoint: '/api/wallet/balance',
          statusCode: err.statusCode,
          message: err.message,
          context: err.context,
          cause: err.cause
        })
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance')
        console.error('Unexpected error fetching wallet balance:', err)
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

