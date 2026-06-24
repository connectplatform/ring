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
  error: string | null
  refresh: () => Promise<void>
}

const WalletListContext = createContext<WalletListContextValue | null>(null)

export function WalletListProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wallet/list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load wallets')
      setWallets(data.wallets ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallets')
      setWallets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void refresh()
  }, [refresh])

  return (
    <WalletListContext.Provider value={{ wallets, isLoading, error, refresh }}>
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
