'use client'

/**
 * Credit Balance Context Provider
 * Provides shared credit balance state across the entire application
 * 
 * Architecture: Single tunnel subscription, multiple consumers
 * - ONE call to useCreditBalance() hook
 * - ONE tunnel subscription to 'credit:balance' channel
 * - Shared state distributed via React Context
 * 
 * Eliminates 7+ duplicate subscriptions from multiple components
 * 
 * @see AI-CONTEXT: ring-platform_tunnel-subscription-loop-fix_emperor_ray_2025-11-24
 */

import { createContext, useContext, ReactNode } from 'react'
import { useCreditBalance } from '@/hooks/use-credit-balance'

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

interface CreditBalanceContextValue {
  balance: CreditBalanceData['balance'] | null
  subscription: CreditBalanceData['subscription'] | null
  limits: CreditBalanceData['limits'] | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  lastRefreshed: number | null
  isTunnelConnected: boolean
}

const CreditBalanceContext = createContext<CreditBalanceContextValue | null>(null)

export function CreditBalanceProvider({ children }: { children: ReactNode }) {
  // SINGLE hook call for entire app - creates ONE tunnel subscription
  const creditData = useCreditBalance()
  
  return (
    <CreditBalanceContext.Provider value={creditData}>
      {children}
    </CreditBalanceContext.Provider>
  )
}

/**
 * Hook to access credit balance context
 * Must be used within CreditBalanceProvider
 */
export function useCreditBalanceContext() {
  const context = useContext(CreditBalanceContext)
  if (!context) {
    throw new Error('useCreditBalanceContext must be used within CreditBalanceProvider')
  }
  return context
}

/**
 * Optional hook that returns null if not within provider
 * Use for components that might render outside the provider tree
 */
export function useOptionalCreditBalance() {
  return useContext(CreditBalanceContext)
}
