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
import type { WalletInfo } from '@/features/wallet/services/list-wallets'

export type WalletListContextValue = {
  wallets: WalletInfo[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WalletListContext = createContext<WalletListContextValue | null>(null)

/** Polling interval for auto-refresh (matches User Story 60s requirement). */
const AUTO_REFRESH_MS = 60_000

export function WalletListProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWallets = useCallback(async (refreshParam = false) => {
    if (refreshParam) setIsRefreshing(true)
    else if (!loadedRef.current) setIsLoading(true)

    setError(null)
    try {
      const url = refreshParam ? '/api/wallet/list?refresh=true' : '/api/wallet/list'
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load wallets')
      setWallets(data.wallets ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallets')
      setWallets([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  /** Refresh button handler — force on-chain fetch. */
  const refresh = useCallback(async () => {
    await fetchWallets(true)
  }, [fetchWallets])

  // ── Initial load ──
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void fetchWallets(false)
  }, [fetchWallets])

  // ── 60s auto-refresh (non-forced — respects DB cache TTL) ──
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchWallets(false)
    }, AUTO_REFRESH_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchWallets])

  return (
    <WalletListContext.Provider value={{ wallets, isLoading, isRefreshing, error, refresh }}>
      {children}
    </WalletListContext.Provider>
  )
}

export function useWalletListContext(): WalletListContextValue {
  const ctx = useContext(WalletListContext)
  if (!ctx) {
    throw new Error('useWalletListContext must be used within WalletListProvider')
  }
  return ctx
}
