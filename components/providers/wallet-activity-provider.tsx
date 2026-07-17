'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  WalletActivityFeedFilter,
  WalletActivityRow,
} from '@/features/wallet/services/wallet-activity-feed'

export type WalletActivityFilter = WalletActivityFeedFilter

export type WalletActivityScope =
  | { type: 'all' }
  | { type: 'credit' }
  | { type: 'chain' }
  | { type: 'incoming' }
  | { type: 'outgoing' }
  | { type: 'requests' }
  | { type: 'wallet'; address: string }

export type WalletActivityContextValue = {
  activities: WalletActivityRow[]
  filter: WalletActivityFilter
  scope: WalletActivityScope
  isLoading: boolean
  error: string | null
  setScope: (scope: WalletActivityScope) => void
  refresh: () => Promise<void>
}

const WalletActivityContext = createContext<WalletActivityContextValue | null>(null)

function scopeToFilter(scope: WalletActivityScope): WalletActivityFilter {
  if (scope.type === 'credit') return 'credit'
  if (scope.type === 'chain') return 'chain'
  if (scope.type === 'incoming') return 'incoming'
  if (scope.type === 'outgoing') return 'outgoing'
  if (scope.type === 'requests') return 'requests'
  // Wallet scope needs chain txs for that address PLUS desk credit legs
  if (scope.type === 'wallet') return 'all'
  return 'all'
}

export function WalletActivityProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<WalletActivityScope>({ type: 'all' })
  const [activities, setActivities] = useState<WalletActivityRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const filter = scopeToFilter(scope)

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ filter, limit: '50' })
      if (scope.type === 'wallet') {
        params.set('walletAddress', scope.address)
      }
      const res = await fetch(`/api/wallet/activity?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load activity')
      if (requestId !== requestIdRef.current) return
      setActivities(data.activities ?? [])
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load activity')
      setActivities([])
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [filter, scope])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <WalletActivityContext.Provider
      value={{ activities, filter, scope, isLoading, error, setScope, refresh }}
    >
      {children}
    </WalletActivityContext.Provider>
  )
}

export function useWalletActivityContext(): WalletActivityContextValue {
  const ctx = useContext(WalletActivityContext)
  if (!ctx) {
    throw new Error('useWalletActivityContext must be used within WalletActivityProvider')
  }
  return ctx
}
