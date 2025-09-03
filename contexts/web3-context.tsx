'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { ethers } from 'ethers'
import { useSession } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'
import { eventBus } from '@/lib/event-bus.client'
import { POLYGON_CHAIN_ID, POLYGON_RPC_URL } from '@/constants/web3'

export interface Web3ContextType {
  provider?: ethers.BrowserProvider | null
  signer?: ethers.Signer | null
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
}

const Web3Context = createContext<Web3ContextType>({
  provider: null,
  signer: null,
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
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Connect with Ring platform wallet (from Auth.js session)
  const connectWithWallet = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      if (!session?.user?.wallets?.[0]?.address) {
        throw new Error('No wallet found in session. Please log in first.')
      }

      // For Ring platform wallets, we use a read-only provider
      // Transactions will be handled server-side with encrypted private keys
      const readOnlyProvider = new ethers.JsonRpcProvider(POLYGON_RPC_URL)
      setProvider(readOnlyProvider as any)
      
      const walletAddress = session.user.wallets[0].address
      setAddress(walletAddress)
      setIsConnected(true)
      
      // Get chain ID
      const network = await readOnlyProvider.getNetwork()
      setChainId(Number(network.chainId))
      
      localStorage.setItem('walletConnected', 'true')
      localStorage.setItem('connectionMethod', 'wallet')
      
      // Notify listeners for an immediate balance refresh
      eventBus.emit('wallet:balance:refresh', { reason: 'connect:session-wallet', address: walletAddress })

      toast({
        title: 'Wallet Connected',
        description: `Connected to Ring wallet: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`,
      })
    } catch (err) {
      console.error('Error connecting to Ring wallet:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(new Error(errorMessage))
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [session])

  // Connect with MetaMask
  const connectWithMetaMask = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.')
      }

      // Create provider and signer
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      setProvider(browserProvider)
      
      const browserSigner = await browserProvider.getSigner()
      setSigner(browserSigner)
      
      const walletAddress = await browserSigner.getAddress()
      setAddress(walletAddress)
      setIsConnected(true)
      
      // Get chain ID
      const network = await browserProvider.getNetwork()
      setChainId(Number(network.chainId))
      
      // Check if on Polygon network
      if (Number(network.chainId) !== POLYGON_CHAIN_ID) {
        await switchNetwork(POLYGON_CHAIN_ID)
      }
      
      localStorage.setItem('walletConnected', 'true')
      localStorage.setItem('connectionMethod', 'metamask')
      
      eventBus.emit('wallet:balance:refresh', { reason: 'connect:metamask', address: walletAddress })

      toast({
        title: 'MetaMask Connected',
        description: `Connected to ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`,
      })
    } catch (err) {
      console.error('Error connecting to MetaMask:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect MetaMask'
      setError(new Error(errorMessage))
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // Switch network
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not available')
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      })
      
      setChainId(targetChainId)
      
      toast({
        title: 'Network Switched',
        description: 'Successfully switched to Polygon network',
      })
    } catch (err: any) {
      // If the chain hasn't been added to MetaMask
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${targetChainId.toString(16)}`,
              chainName: 'Polygon',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18,
              },
              rpcUrls: [POLYGON_RPC_URL],
              blockExplorerUrls: ['https://polygonscan.com/'],
            }],
          })
          
          setChainId(targetChainId)
        } catch (addError) {
          console.error('Error adding network:', addError)
          throw new Error('Failed to add Polygon network to MetaMask')
        }
      } else {
        throw err
      }
    }
  }, [])

  // Get token balance
  const getBalance = useCallback(async (tokenAddress?: string): Promise<string> => {
    if (!address) return '0'
    
    try {
      const currentProvider = provider || new ethers.JsonRpcProvider(POLYGON_RPC_URL)
      
      if (!tokenAddress) {
        // Get native token balance (MATIC)
        const balance = await currentProvider.getBalance(address)
        return ethers.formatEther(balance)
      } else {
        // Get ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)'],
          currentProvider
        )
        const balance = await tokenContract.balanceOf(address)
        return ethers.formatEther(balance)
      }
    } catch (err) {
      console.error('Error getting balance:', err)
      return '0'
    }
  }, [address, provider])

  // Generic connect function
  const connect = useCallback(async (method: 'metamask' | 'wallet' | 'google' = 'wallet') => {
    if (method === 'metamask') {
      return connectWithMetaMask()
    } else if (method === 'wallet' || method === 'google') {
      return connectWithWallet()
    }
  }, [connectWithMetaMask, connectWithWallet])

  // Disconnect wallet
  const disconnect = useCallback(() => {
    const connectionMethod = localStorage.getItem('connectionMethod')
    
    setProvider(null)
    setSigner(null)
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
  }, [])

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
    provider,
    signer,
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
  }

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}
