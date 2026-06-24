'use client'

/**
 * Wallet-scoped credit transaction history provider.
 *
 * SSOT: one GET /api/wallet/credit/history per wallet shell (limit 50).
 * Right rail slices recent rows; center feed uses the full list.
 *
 * Mounted in WalletWrapper — not app-global (history is wallet-route scoped).
 *
 * @see components/providers/credit-balance-provider.tsx
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useCreditHistory } from '@/hooks/use-credit-history'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'

export interface CreditHistoryContextValue {
  transactions: CreditTransaction[]
  hasMore: boolean
  nextCursor: string | undefined
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

const CreditHistoryContext = createContext<CreditHistoryContextValue | null>(null)

const DEFAULT_LIMIT = 50

interface CreditHistoryProviderProps {
  children: ReactNode
  /** Default page size for the wallet transaction feed */
  limit?: number
}

export function CreditHistoryProvider({
  children,
  limit = DEFAULT_LIMIT,
}: CreditHistoryProviderProps) {
  const { lastRefreshed } = useCreditBalanceContext()
  const history = useCreditHistory({ limit })

  useEffect(() => {
    if (!lastRefreshed) return
    void history.refresh().catch(() => {
      /* useCreditHistory handles errors internally */
    })
  }, [lastRefreshed, history.refresh])

  return (
    <CreditHistoryContext.Provider value={history}>{children}</CreditHistoryContext.Provider>
  )
}

export function useCreditHistoryContext(): CreditHistoryContextValue {
  const context = useContext(CreditHistoryContext)
  if (!context) {
    throw new Error('useCreditHistoryContext must be used within CreditHistoryProvider')
  }
  return context
}

export function useOptionalCreditHistory() {
  return useContext(CreditHistoryContext)
}
