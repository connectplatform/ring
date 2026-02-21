'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
// ethers.js removed - fully migrated to wagmi + viem
import { useSession } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'
import { eventBus } from '@/lib/event-bus.client'
import { POLYGON_CHAIN_ID, POLYGON_RPC_URL } from '@/constants/web3'

// Wagmi imports for modern Web3 functionality
import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance, useChainId } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'

export interface Web3ContextType {
  // Legacy API - removed (fully migrated to wagmi)
  // provider?: ethers.BrowserProvider | null
  // signer?: ethers.Signer | null
  address?: string | null
  isConnected: boolean
  isConnecting: boolean
  connect: (method?: 'metamask' | 'wallet' | 'google') => Promise<void>
  disconnect: () => void
  chainId?: number | null
  error?: Error | null
  connectWithWallet: () => Promise<void>
  connectWithMetaMask: () => Promise<void>
  switchNetwork: (targetChainId: number) => Promise<void>
  getBalance: (tokenAddress?: string) => Promise<string>

  // Modern API (wagmi) - primary functionality
  wagmiAddress?: `0x${string}` | undefined
  wagmiIsConnected: boolean
  wagmiIsConnecting: boolean
  wagmiChainId?: number
}

const Web3Context = createContext<Web3ContextType>({
  // Legacy API - removed
  address: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  chainId: null,
  error: null,
  connectWithWallet: async () => {},
  connectWithMetaMask: async () => {},
  switchNetwork: async () => {},
  getBalance: async () => '0',

  // Modern API defaults
  wagmiAddress: undefined,
  wagmiIsConnected: false,
  wagmiIsConnecting: false,
  wagmiChainId: undefined,
})

export const useWeb3 = () => {
  const context = useContext(Web3Context)
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider')
  }
  return context
}

interface Web3ProviderProps {
  children: ReactNode
}



export function Web3Provider({ children }: Web3ProviderProps) {
  const { data: session, status } = useSession()

  // Legacy state - removed (using wagmi directly)
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Modern wagmi hooks
  const { address: wagmiAddress, isConnected: wagmiIsConnected, isConnecting: wagmiIsConnecting } = useAccount()
  const { connect: wagmiConnect, connectors } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()
  const wagmiChainId = useChainId()
  const { data: wagmiBalance } = useBalance({ address: wagmiAddress })

  // Sync wagmi state with legacy state for backward compatibility
  useEffect(() => {
    setAddress(wagmiAddress || null)
    setIsConnected(wagmiIsConnected)
    setIsConnecting(wagmiIsConnecting)
    setChainId(wagmiChainId || null)
  }, [wagmiAddress, wagmiIsConnected, wagmiIsConnecting, wagmiChainId])

  // Connect with Ring platform wallet (from Auth.js session)
  const connectWithWallet = useCallback(async () => {
    // For Ring platform wallets, we redirect to the multi-chain dashboard
    // since wallet connections are now handled by wagmi/RainbowKit
    toast({
      title: 'Wallet Connection Updated',
      description: 'Please use the multi-chain wallet dashboard for connections',
    })

    // Could redirect to wallet dashboard here if needed
    // router.push('/wallet')
  }, [])

  // Connect with MetaMask (using wagmi)
  const connectWithMetaMask = useCallback(async () => {
    try {
      const metaMaskConnector = connectors.find(connector => connector.name === 'MetaMask')
      if (metaMaskConnector) {
        wagmiConnect({ connector: metaMaskConnector })
      } else {
        throw new Error('MetaMask connector not found')
      }
    } catch (err) {
      console.error('Error connecting to MetaMask:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect MetaMask'
      setError(new Error(errorMessage))
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }, [connectors, wagmiConnect])

  // Switch network (using wagmi)
  const switchNetwork = useCallback(async (targetChainId: number) => {
    try {
      wagmiSwitchChain({ chainId: targetChainId })

      toast({
        title: 'Network Switched',
        description: 'Successfully switched network',
      })
    } catch (err) {
      console.error('Error switching network:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch network'
      setError(new Error(errorMessage))
      toast({
        title: 'Network Switch Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }, [wagmiSwitchChain])

  // Get token balance (deprecated - use wagmi hooks directly)
  const getBalance = useCallback(async (tokenAddress?: string): Promise<string> => {
    // Balance fetching is now handled by wagmi hooks in components
    // Use useBalance and useReadContract hooks directly
    console.warn('getBalance function is deprecated - use wagmi hooks directly')
    if (wagmiBalance) {
      const value = wagmiBalance.value
      const decimals = wagmiBalance.decimals
      const formatted = (Number(value) / Math.pow(10, decimals)).toString()
      return formatted
    }
    return '0'
  }, [wagmiBalance])

  // Generic connect function
  const connect = useCallback(async (method: 'metamask' | 'wallet' | 'google' = 'wallet') => {
    if (method === 'metamask') {
      return connectWithMetaMask()
    } else if (method === 'wallet' || method === 'google') {
      return connectWithWallet()
    }
  }, [connectWithMetaMask, connectWithWallet])

  // Disconnect wallet (using wagmi)
  const disconnect = useCallback(() => {
    // Disconnect wagmi first
    wagmiDisconnect()

    const connectionMethod = localStorage.getItem('connectionMethod')

    // Legacy state cleared via wagmi disconnect
    setAddress(null)
    setIsConnected(false)
    setChainId(null)
    setError(null)

    localStorage.removeItem('walletConnected')
    localStorage.removeItem('connectionMethod')

    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    })
  }, [wagmiDisconnect])

  // Auto-connect Ring wallet when session is available
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.wallets?.[0]?.address && !isConnected) {
      const connectionMethod = localStorage.getItem('connectionMethod')
      
      // Only auto-connect if previously connected with wallet method or no method stored
      if (!connectionMethod || connectionMethod === 'wallet') {
        connectWithWallet()
      }
    }
  }, [status, session, isConnected, connectWithWallet])

  // Reconnect on page load
  useEffect(() => {
    const reconnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected') === 'true'
      const connectionMethod = localStorage.getItem('connectionMethod')
      
      if (wasConnected && !isConnected && !isConnecting) {
        if (connectionMethod === 'metamask' && window.ethereum) {
          // Check if MetaMask is still connected
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_accounts' 
            })
            if (accounts && accounts.length > 0) {
              await connectWithMetaMask()
            } else {
              // MetaMask is locked or disconnected
              localStorage.removeItem('walletConnected')
              localStorage.removeItem('connectionMethod')
            }
          } catch (err) {
            console.error('Error checking MetaMask connection:', err)
          }
        }
        // Wallet connection is handled by session auto-connect
      }
    }
    
    reconnect()
  }, []) // Only run once on mount

  // Listen for MetaMask events
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // MetaMask is locked or the user has disconnected
        disconnect()
        eventBus.emit('wallet:balance:refresh', { reason: 'disconnect:metamask', address: null })
      } else if (accounts[0] !== address && localStorage.getItem('connectionMethod') === 'metamask') {
        // User switched accounts in MetaMask
        eventBus.emit('wallet:balance:refresh', { reason: 'account-changed', address: accounts[0] })
        window.location.reload() // Reload to re-initialize with new account
      }
    }

    const handleChainChanged = (chainId: string) => {
      // Reload the page when chain changes
      eventBus.emit('wallet:balance:refresh', { reason: 'chain-changed', address })
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [address, disconnect])

  const value: Web3ContextType = {
    // Legacy API - removed (fully migrated to wagmi)
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    chainId,
    error,
    connectWithWallet,
    connectWithMetaMask,
    switchNetwork,
    getBalance,

    // Modern API (wagmi) - primary functionality
    wagmiAddress,
    wagmiIsConnected,
    wagmiIsConnecting,
    wagmiChainId,
  }

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}
