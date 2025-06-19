import { useState, useEffect } from 'react'

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
}

/**
 * Hook to fetch wallet balance using the API endpoint
 * Fixed to prevent infinite recursion and work with React 19
 */
export function useWalletBalance(enabled: boolean = true): UseWalletBalanceReturn {
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    if (!enabled) return

    setIsLoading(true)
    setIsError(false)
    setError(null)

    try {
      const response = await fetch('/api/wallet/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: WalletBalanceResponse = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setBalance(data.balance)
    } catch (err) {
      console.error('Error fetching wallet balance:', err)
      setIsError(true)
      setError(err instanceof Error ? err.message : 'Failed to fetch balance')
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
    refetch
  }
}

