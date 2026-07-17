'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatNativeBalance } from '@/features/wallet/utils/balance-cache'
import { getClientNativeTokenSymbol } from '@/lib/ring-config-client'

export type UsePrimaryNativeBalanceOptions = {
  /** When false, skip fetch (e.g. mobile menu closed). Default true. */
  enabled?: boolean
}

export type PrimaryNativeBalanceState = {
  nativeBalance: string | null
  loading: boolean
  error: string | null
  symbol: string
  formatted: string
  refresh: () => Promise<void>
}

async function fetchPrimaryNativeBalance(): Promise<string> {
  const res = await fetch('/api/wallet/list', { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`wallet_list_${res.status}`)
  }
  const data = (await res.json()) as {
    wallets?: Array<{ isPrimary?: boolean; nativeBalance?: string }>
  }
  const wallets = data.wallets ?? []
  const primary = wallets.find((w) => w.isPrimary) ?? wallets[0]
  return primary?.nativeBalance ?? '0'
}

/**
 * Primary custodial wallet native-token balance via GET /api/wallet/list.
 * Shared by mobile floating user widget + profile Balances card.
 *
 * SSOT for client native RING display. Prefer this over:
 * - deprecated `useTokenBalance` (alias in use-token-balance.ts)
 * - non-existent `useNativeTokenBalance` (server helpers are getNativeTokenBalance*)
 */
export function usePrimaryNativeBalance(
  options: UsePrimaryNativeBalanceOptions = {},
): PrimaryNativeBalanceState {
  const { enabled = true } = options
  const { data: session } = useSession()
  const [nativeBalance, setNativeBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const symbol = getClientNativeTokenSymbol()
  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) {
      setNativeBalance(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const balance = await fetchPrimaryNativeBalance()
      setNativeBalance(balance)
    } catch (err) {
      setNativeBalance(null)
      setError(err instanceof Error ? err.message : 'fetch_failed')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const balance = await fetchPrimaryNativeBalance()
        if (!cancelled) setNativeBalance(balance)
      } catch (err) {
        if (!cancelled) {
          setNativeBalance(null)
          setError(err instanceof Error ? err.message : 'fetch_failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [enabled, userId])

  return {
    nativeBalance,
    loading,
    error,
    symbol,
    formatted: formatNativeBalance(nativeBalance ?? '0'),
    refresh,
  }
}
