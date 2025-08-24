'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'

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

/**
 * Hook for managing user's RING credit balance
 */
export function useCreditBalance(): UseCreditBalanceReturn {
  const [data, setData] = useState<CreditBalanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  const fetchBalance = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      
      setError(null)

      const response = await fetch('/api/wallet/credit/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        throw new Error(`Failed to fetch balance: ${response.status}`)
      }

      const balanceData: CreditBalanceData = await response.json()
      setData(balanceData)
      setLastRefreshed(Date.now())
      
      logger.info('Credit balance fetched', { 
        amount: balanceData.balance.amount,
        subscriptionActive: balanceData.subscription.active,
        isRefresh 
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      
      logger.error('Failed to fetch credit balance', { error: err, isRefresh })
      
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

  // Initial load
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Auto-refresh every 30 seconds for balance updates
  useEffect(() => {
    if (!data) return

    const interval = setInterval(() => {
      fetchBalance(true)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [data, fetchBalance])

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
