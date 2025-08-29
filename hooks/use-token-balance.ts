'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ethers } from 'ethers'
import { useWeb3 } from '@/contexts/web3-context'
import { 
  RING_TOKEN_ADDRESS, 
  WPOL_ADDRESS, 
  USDT_ADDRESS, 
  USDC_ADDRESS,
  TOKEN_CONFIGS,
  POLYGON_RPC_URL
} from '@/constants/web3'
import type { TokenBalance, WalletBalances } from '@/features/wallet/types'

// Global singleton state to prevent multiple instances
let globalTokenBalances: WalletBalances = { RING: '0', POL: '0', USDT: '0', USDC: '0' }
let globalIsLoading = true
let globalLastFetchTime = 0
let globalIsFetching = false
const globalSubscribers: Set<(balances: WalletBalances, loading: boolean) => void> = new Set()
let globalInterval: NodeJS.Timeout | null = null
let globalCurrentAddress: string | null = null

// Throttle fetch to prevent excessive RPC calls (8 seconds)
const FETCH_THROTTLE_MS = 8000
// Auto-refresh interval (3 minutes)
const AUTO_REFRESH_INTERVAL = 180000

/**
 * Global fetch function shared by all hook instances
 */
const globalFetchTokenBalances = async (
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider,
  address: string,
  isConnected: boolean,
  force: boolean = false
): Promise<void> => {
  // Check throttling
  const now = Date.now()
  if (!force && globalIsFetching) {
    console.log('📊 GLOBAL: Token balance fetch already in progress')
    return
  }
  
  if (!force && now - globalLastFetchTime < FETCH_THROTTLE_MS) {
    console.log(`📊 GLOBAL: Token balance fetch throttled, last fetch was ${now - globalLastFetchTime}ms ago`)
    return
  }

  if (!isConnected || !address) {
    console.log('📊 GLOBAL: Not fetching - wallet not connected')
    globalTokenBalances = { RING: '0', POL: '0', USDT: '0', USDC: '0' }
    globalIsLoading = false
    // Notify all subscribers
    globalSubscribers.forEach(callback => callback(globalTokenBalances, false))
    return
  }

  // Address changed - reset state
  if (address !== globalCurrentAddress) {
    console.log(`📊 GLOBAL: Address changed from ${globalCurrentAddress} to ${address}`)
    globalCurrentAddress = address
    globalTokenBalances = { RING: '0', POL: '0', USDT: '0', USDC: '0' }
    globalIsLoading = true
  }

  globalIsFetching = true
  globalLastFetchTime = now
  
  console.log(`📊 GLOBAL: Fetching token balances for address: ${address} (${globalSubscribers.size} subscribers)`)

  try {
    const balances: WalletBalances = {}
    
    // Fetch native POL balance
    try {
      const polBalance = await provider.getBalance(address)
      balances.POL = ethers.formatEther(polBalance)
    } catch (err) {
      console.error('Error fetching POL balance:', err)
      balances.POL = '0'
    }

    // Fetch RING token balance (if deployed)
    if (RING_TOKEN_ADDRESS && RING_TOKEN_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      try {
        const ringContract = new ethers.Contract(
          RING_TOKEN_ADDRESS,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        )
        const ringBalance = await ringContract.balanceOf(address)
        balances.RING = ethers.formatEther(ringBalance)
      } catch (err) {
        console.error('Error fetching RING balance:', err)
        balances.RING = '0'
      }
    } else {
      balances.RING = '0'
    }

    // Fetch USDT balance
    try {
      const usdtContract = new ethers.Contract(
        USDT_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      )
      const usdtBalance = await usdtContract.balanceOf(address)
      balances.USDT = ethers.formatUnits(usdtBalance, 6) // USDT has 6 decimals
    } catch (err) {
      console.error('Error fetching USDT balance:', err)
      balances.USDT = '0'
    }

    // Fetch USDC balance
    try {
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      )
      const usdcBalance = await usdcContract.balanceOf(address)
      balances.USDC = ethers.formatUnits(usdcBalance, 6) // USDC has 6 decimals
    } catch (err) {
      console.error('Error fetching USDC balance:', err)
      balances.USDC = '0'
    }

    globalTokenBalances = balances
    globalIsLoading = false
    
    console.log(`📊 GLOBAL: Token balances fetched (${globalSubscribers.size} subscribers):`, balances)
    
    // Notify all subscribers
    globalSubscribers.forEach(callback => callback(balances, false))
  } catch (error) {
    console.error('📊 GLOBAL: Error fetching token balances:', error)
    globalIsLoading = false
    // Notify all subscribers of the error state
    globalSubscribers.forEach(callback => callback(globalTokenBalances, false))
  } finally {
    globalIsFetching = false
  }
}

/**
 * Hook to fetch and manage token balances with global singleton pattern
 */
export function useTokenBalance() {
  const { provider, address, isConnected } = useWeb3()
  const [tokenBalances, setTokenBalances] = useState<WalletBalances>(globalTokenBalances)
  const [isLoading, setIsLoading] = useState(globalIsLoading)
  const [tokenList, setTokenList] = useState<TokenBalance[]>([])
  
  // Create stable subscriber callback
  const subscriberCallback = useCallback((balances: WalletBalances, loading: boolean) => {
    setTokenBalances(balances)
    setIsLoading(loading)
  }, [])

  // Subscribe to global state on mount
  useEffect(() => {
    console.log(`📊 HOOK: New useTokenBalance instance mounted (${globalSubscribers.size + 1} total)`)
    globalSubscribers.add(subscriberCallback)
    
    // Set initial state from global
    setTokenBalances(globalTokenBalances)
    setIsLoading(globalIsLoading)
    
    return () => {
      console.log(`📊 HOOK: useTokenBalance instance unmounting (${globalSubscribers.size - 1} remaining)`)
      globalSubscribers.delete(subscriberCallback)
      
      // Clean up global interval if no subscribers left
      if (globalSubscribers.size === 0 && globalInterval) {
        console.log('📊 GLOBAL: No subscribers left, clearing interval')
        clearInterval(globalInterval)
        globalInterval = null
      }
    }
  }, [subscriberCallback])

  // Fetch token balances
  const fetchTokenBalances = useCallback(async (force: boolean = false) => {
    if (!isConnected || !address) {
      console.log('📊 HOOK: Not fetching - wallet not connected')
      return
    }

    const currentProvider = provider || new ethers.JsonRpcProvider(POLYGON_RPC_URL)
    await globalFetchTokenBalances(currentProvider, address, isConnected, force)
  }, [provider, address, isConnected])

  // Convert balances to token list
  useEffect(() => {
    const tokens: TokenBalance[] = []
    
    if (tokenBalances.RING) {
      tokens.push({
        symbol: 'RING',
        name: 'Ring Token',
        balance: tokenBalances.RING,
        decimals: 18,
        tokenAddress: RING_TOKEN_ADDRESS,
      })
    }
    
    if (tokenBalances.POL) {
      tokens.push({
        symbol: 'POL',
        name: 'Polygon',
        balance: tokenBalances.POL,
        decimals: 18,
        tokenAddress: WPOL_ADDRESS,
      })
    }
    
    if (tokenBalances.USDT) {
      tokens.push({
        symbol: 'USDT',
        name: 'Tether USD',
        balance: tokenBalances.USDT,
        decimals: 6,
        tokenAddress: USDT_ADDRESS,
      })
    }
    
    if (tokenBalances.USDC) {
      tokens.push({
        symbol: 'USDC',
        name: 'USD Coin',
        balance: tokenBalances.USDC,
        decimals: 6,
        tokenAddress: USDC_ADDRESS,
      })
    }
    
    setTokenList(tokens)
  }, [tokenBalances])

  // Initial fetch and setup auto-refresh (only first subscriber sets up interval)
  useEffect(() => {
    if (!isConnected || !address) return

    // Initial fetch
    fetchTokenBalances()

    // Set up auto-refresh interval only if not already set
    if (!globalInterval && globalSubscribers.size === 1) {
      console.log('📊 GLOBAL: Setting up auto-refresh interval (first subscriber)')
      globalInterval = setInterval(() => {
        console.log('📊 GLOBAL: Auto-refresh triggered')
        fetchTokenBalances()
      }, AUTO_REFRESH_INTERVAL)
    }

    return () => {
      // Interval cleanup is handled in the subscriber cleanup
    }
  }, [isConnected, address, fetchTokenBalances])

  // Manual refresh function
  const refresh = useCallback(async () => {
    console.log('📊 HOOK: Manual refresh requested')
    await fetchTokenBalances(true) // Force refresh
  }, [fetchTokenBalances])

  return {
    tokenBalances,
    tokenList,
    isLoading,
    refresh,
    fetchTokenBalances,
  }
}
