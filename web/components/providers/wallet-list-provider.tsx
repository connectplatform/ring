'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { WalletInfo } from '@/features/wallet/services/list-wallets'
import { useTunnelChannel } from '@/hooks/use-tunnel-channel'

export type WalletListContextValue = {
  wallets: WalletInfo[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  isTunnelConnected: boolean
}

const WalletListContext = createContext<WalletListContextValue | null>(null)

/** Fallback poll only when tunnel is down (matches useCreditBalance). */
const FALLBACK_REFRESH_MS = 60_000

type WalletListTunnelPayload = {
  action?: 'updated' | 'refreshed' | 'provisioned'
  timestamp?: number
}

export function WalletListProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  /** null until first observation — avoids double-fetch when tunnel is already up on mount */
  const wasTunnelConnectedRef = useRef<boolean | null>(null)
  const fetchWalletsRef = useRef<(refreshParam?: boolean) => Promise<void>>(async () => {})

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

  fetchWalletsRef.current = fetchWallets

  const refresh = useCallback(async () => {
    await fetchWallets(true)
  }, [fetchWallets])

  const onTunnelInvalidate = useEffectEvent((_payload: WalletListTunnelPayload) => {
    // Invalidate signal — re-read via DB cache (no forced on-chain unless user clicks Refresh)
    void fetchWalletsRef.current(false)
  })

  const { isConnected: isTunnelConnected } = useTunnelChannel<WalletListTunnelPayload>({
    channel: 'wallet:list',
    enabled: true,
    onMessage: onTunnelInvalidate,
  })

  // ── Initial load ──
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void fetchWallets(false)
  }, [fetchWallets])

  // ── Catch up when tunnel reconnects (skip first observation to avoid double-fetch) ──
  useEffect(() => {
    if (wasTunnelConnectedRef.current === null) {
      wasTunnelConnectedRef.current = isTunnelConnected
      return
    }

    const wasConnected = wasTunnelConnectedRef.current
    wasTunnelConnectedRef.current = isTunnelConnected

    if (isTunnelConnected && !wasConnected && loadedRef.current) {
      void fetchWallets(false)
    }
  }, [fetchWallets, isTunnelConnected])

  // ── Fallback poll only when tunnel is NOT connected ──
  useEffect(() => {
    if (isTunnelConnected) return
    if (!loadedRef.current) return

    const interval = setInterval(() => {
      void fetchWallets(false)
    }, FALLBACK_REFRESH_MS)

    return () => clearInterval(interval)
  }, [fetchWallets, isTunnelConnected])

  return (
    <WalletListContext.Provider
      value={{ wallets, isLoading, isRefreshing, error, refresh, isTunnelConnected }}
    >
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
