'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useBalance, useReadContract, useBlockNumber } from 'wagmi'
import { formatUnits } from 'viem'
import {
  RING_TOKEN_ADDRESS,
  WPOL_ADDRESS,
  USDT_ADDRESS,
  USDC_ADDRESS,
  TOKEN_CONFIGS
} from '@/constants/web3'
import type { TokenBalance, WalletBalances } from '@/features/wallet/types'
import { eventBus } from '@/lib/event-bus.client'

// ERC20 ABI for balanceOf calls
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Throttle fetch to prevent excessive RPC calls (8 seconds)
const FETCH_THROTTLE_MS = 8000
// Auto-refresh interval (3 minutes)
const AUTO_REFRESH_INTERVAL = 180000
// Debounce push-initiated refreshes to avoid bursts (e.g., 1s)
const PUSH_DEBOUNCE_MS = 1000

/**
 * Hook to fetch and manage token balances using wagmi
 */
export function useTokenBalance() {
  const { address, isConnected } = useAccount()
  const { data: blockNumber } = useBlockNumber({ watch: true })

  // Native POL balance
  const { data: polBalance, isLoading: polLoading, refetch: refetchPol } = useBalance({
    address: address as `0x${string}`,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // RING token balance
  const { data: ringBalance, isLoading: ringLoading, refetch: refetchRing } = useReadContract({
    address: RING_TOKEN_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && isConnected && !!RING_TOKEN_ADDRESS,
    },
  })

  // USDT token balance
  const { data: usdtBalance, isLoading: usdtLoading, refetch: refetchUsdt } = useReadContract({
    address: USDT_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // USDC token balance
  const { data: usdcBalance, isLoading: usdcLoading, refetch: refetchUsdc } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // Combine all balances
  const tokenBalances: WalletBalances = {
    POL: polBalance ? formatUnits(polBalance.value, polBalance.decimals) : '0',
    RING: ringBalance ? formatUnits(ringBalance as bigint, 18) : '0',
    USDT: usdtBalance ? formatUnits(usdtBalance as bigint, 6) : '0',
    USDC: usdcBalance ? formatUnits(usdcBalance as bigint, 6) : '0',
  }

  // Combined loading state
  const isLoading = polLoading || ringLoading || usdtLoading || usdcLoading

  // Convert balances to token list
  const tokenList: TokenBalance[] = []

  if (tokenBalances.RING && tokenBalances.RING !== '0') {
    tokenList.push({
      symbol: 'RING',
      name: 'Ring Token',
      balance: tokenBalances.RING,
      decimals: 18,
      tokenAddress: RING_TOKEN_ADDRESS,
    })
  }

  if (tokenBalances.POL && tokenBalances.POL !== '0') {
    tokenList.push({
      symbol: 'POL',
      name: 'Polygon',
      balance: tokenBalances.POL,
      decimals: 18,
      tokenAddress: WPOL_ADDRESS,
    })
  }

  if (tokenBalances.USDT && tokenBalances.USDT !== '0') {
    tokenList.push({
      symbol: 'USDT',
      name: 'Tether USD',
      balance: tokenBalances.USDT,
      decimals: 6,
      tokenAddress: USDT_ADDRESS,
    })
  }

  if (tokenBalances.USDC && tokenBalances.USDC !== '0') {
    tokenList.push({
      symbol: 'USDC',
      name: 'USD Coin',
      balance: tokenBalances.USDC,
      decimals: 6,
      tokenAddress: USDC_ADDRESS,
    })
  }

  // Manual refresh function
  const refresh = useCallback(async () => {
    console.log('📊 HOOK: Manual refresh requested')
    await Promise.all([
      refetchPol(),
      refetchRing(),
      refetchUsdt(),
      refetchUsdc(),
    ])
  }, [refetchPol, refetchRing, refetchUsdt, refetchUsdc])

  // Auto-refresh on block changes
  useEffect(() => {
    if (blockNumber && isConnected && address) {
      console.log('📊 HOOK: Block changed, refreshing balances')
      refresh()
    }
  }, [blockNumber, isConnected, address, refresh])

  // Listen to event-bus balance refresh signals
  useEffect(() => {
    const off = eventBus.on('wallet:balance:refresh', () => {
      console.log('📊 HOOK: Event-bus balance refresh triggered')
      refresh()
    })

    return () => {
      off()
    }
  }, [refresh])

  return {
    tokenBalances,
    tokenList,
    isLoading,
    refresh,
  }
}
