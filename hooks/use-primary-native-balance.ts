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
  nativeTokenBalance: string | null
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
    wallets?: Array<{ isPrimary?: boolean; nativeTokenBalance?: string }>
  }
  const wallets = data.wallets ?? []
  const primary = wallets.find((w) => w.isPrimary) ?? wallets[0]
  return primary?.nativeTokenBalance ?? '0'
}

/**
 * Primary custodial wallet native-token balance via GET /api/wallet/list.
 * Shared by mobile floating user widget + profile Balances card.
 *
 * For the browser-connected sign-in address (wagmi), use useConnection + useBalance
 * from @/lib/wagmi-config — not this hook.
 */
export function usePrimaryNativeBalance(
  options: UsePrimaryNativeBalanceOptions = {},
): PrimaryNativeBalanceState {
  const { enabled = true } = options
  const { data: session } = useSession()
  const [nativeTokenBalance, setNativeTokenBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const symbol = getClientNativeTokenSymbol()
  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) {
      setNativeTokenBalance(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const balance = await fetchPrimaryNativeBalance()
      setNativeTokenBalance(balance)
    } catch (err) {
      setNativeTokenBalance(null)
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
        if (!cancelled) setNativeTokenBalance(balance)
      } catch (err) {
        if (!cancelled) {
          setNativeTokenBalance(null)
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
    nativeTokenBalance,
    loading,
    error,
    symbol,
    formatted: formatNativeBalance(nativeTokenBalance ?? '0'),
    refresh,
  }
}
