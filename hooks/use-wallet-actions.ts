'use client'

import { useState, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSendTransaction } from 'wagmi'
import { useSession } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'
import {
  RING_TOKEN_ADDRESS,
  RING_STAKING_ADDRESS,
  DEFAULT_GAS_LIMIT,
  DEFAULT_SLIPPAGE_TOLERANCE,
  getPolygonscanUrl
} from '@/constants/web3'
import type { WalletTransaction } from '@/features/wallet/types'

/**
 * Hook for wallet actions like sending tokens, staking, etc.
 */
export function useWalletActions() {
  const { address, isConnected, chainId } = useAccount()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<string | null>(null)

  // Wagmi hooks for contract interactions
  const { writeContract, data: contractHash, isPending: contractPending, error: contractError } = useWriteContract()
  const { isLoading: contractConfirming, isSuccess: contractConfirmed } = useWaitForTransactionReceipt({
    hash: contractHash,
  })

  // Wagmi hooks for native token transfers
  const { sendTransaction: wagmiSendTransaction, data: sendHash, isPending: sendPending, error: sendError } = useSendTransaction()
  const { isLoading: sendConfirming, isSuccess: sendConfirmed } = useWaitForTransactionReceipt({
    hash: sendHash,
  })

  // Combined loading and error states
  const combinedIsLoading = contractPending || contractConfirming || sendPending || sendConfirming
  const combinedHash = contractHash || sendHash
  const combinedIsConfirmed = contractConfirmed || sendConfirmed
  const combinedError = contractError || sendError

  /**
   * Record transaction in database
   */
  const recordTransaction = useCallback(async (
    txHash: string,
    recipient: string,
    amount: string,
    tokenSymbol: string,
    type: WalletTransaction['type'] = 'send',
    notes?: string
  ) => {
    try {
      const response = await fetch('/api/wallet/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          walletAddress: address,
          recipient,
          amount,
          tokenSymbol,
          status: 'pending',
          networkId: chainId || 137,
          type,
          notes,
        }),
      })

      if (!response.ok) {
        console.error('Failed to record transaction')
      }
    } catch (error) {
      console.error('Error recording transaction:', error)
    }
  }, [address, chainId])

  /**
   * Update transaction status
   */
  const updateTransactionStatus = useCallback(async (
    txHash: string,
    status: 'success' | 'failed'
  ) => {
    try {
      const response = await fetch('/api/wallet/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, status }),
      })

      if (!response.ok) {
        console.error('Failed to update transaction status')
      }
    } catch (error) {
      console.error('Error updating transaction status:', error)
    }
  }, [])

  /**
   * Send native POL tokens
   */
  const sendNativeToken = useCallback(async (
    recipient: string,
    amount: string,
    notes?: string
  ): Promise<string | null> => {
    if (!address || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to send tokens',
        variant: 'destructive',
      })
      return null
    }

    setIsLoading(true)
    try {
      // TODO: Implement with wagmi useSendTransaction
      // For now, simulate a successful transaction
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`

      toast({
        title: 'Transaction Submitted (Mock)',
        description: `Mock POL transaction submitted. Wagmi integration coming soon.`,
      })

      // Record transaction
      await recordTransaction(mockTxHash, recipient, amount, 'POL', 'send', notes)

      // Simulate confirmation
      setTimeout(async () => {
        await updateTransactionStatus(mockTxHash, 'success')
        toast({
          title: 'Transaction Successful (Mock)',
          description: `Successfully sent ${amount} POL to ${recipient.slice(0, 8)}...${recipient.slice(-6)}`,
        })
      }, 2000)

      return mockTxHash
    } catch (error: any) {
      console.error('Send transaction error:', error)

      let errorMessage = 'Failed to send transaction'
      if (error?.name === 'UserRejectedRequestError') {
        errorMessage = 'Transaction rejected by user'
      } else if (error?.message) {
        errorMessage = error.message
      }

      toast({
        title: 'Transaction Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    } finally {
      setIsLoading(false)
      setPendingTx(null)
    }
  }, [address, isConnected, wagmiSendTransaction, sendHash, sendConfirmed, sendError, recordTransaction, updateTransactionStatus])

  /**
   * Send ERC20 tokens (RING, USDT, etc.)
   */
  const sendToken = useCallback(async (
    tokenAddress: string,
    recipient: string,
    amount: string,
    tokenSymbol: string,
    decimals: number = 18,
    notes?: string
  ): Promise<string | null> => {
    if (!address || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to send tokens',
        variant: 'destructive',
      })
      return null
    }

    setIsLoading(true)
    try {
      // TODO: Implement with wagmi writeContract
      // For now, simulate a successful transaction
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`

      toast({
        title: 'Transaction Submitted (Mock)',
        description: `Mock transaction submitted. Wagmi integration coming soon.`,
      })

      // Record transaction
      await recordTransaction(mockTxHash, recipient, amount, tokenSymbol, 'send', notes)

      // Simulate confirmation
      setTimeout(async () => {
        await updateTransactionStatus(mockTxHash, 'success')
        toast({
          title: 'Transaction Successful (Mock)',
          description: `Successfully sent ${amount} ${tokenSymbol} to ${recipient.slice(0, 8)}...${recipient.slice(-6)}`,
        })
      }, 2000)

      return mockTxHash
    } catch (error: any) {
      console.error('Send token error:', error)

      let errorMessage = 'Failed to send tokens'
      if (error?.name === 'UserRejectedRequestError') {
        errorMessage = 'Transaction rejected by user'
      } else if (error?.message) {
        errorMessage = error.message
      }

      toast({
        title: 'Transaction Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    } finally {
      setIsLoading(false)
      setPendingTx(null)
    }
  }, [address, isConnected, writeContract, combinedHash, combinedIsConfirmed, combinedError, recordTransaction, updateTransactionStatus])

  /**
   * Send transaction (wrapper for native or token)
   */
  const sendTransaction = useCallback(async (
    recipient: string,
    amount: string,
    tokenSymbol: string,
    tokenAddress?: string,
    decimals?: number,
    notes?: string
  ): Promise<string | null> => {
    if (!tokenAddress || tokenSymbol === 'POL') {
      return sendNativeToken(recipient, amount, notes)
    } else {
      return sendToken(
        tokenAddress,
        recipient,
        amount,
        tokenSymbol,
        decimals || 18,
        notes
      )
    }
  }, [sendNativeToken, sendToken])

  /**
   * Stake tokens
   */
  const stakeTokens = useCallback(async (
    amount: string,
    poolId: string
  ): Promise<string | null> => {
    if (!address || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to stake tokens',
        variant: 'destructive',
      })
      return null
    }

    // TODO: Implement staking with wagmi writeContract
    toast({
      title: 'Staking Coming Soon',
      description: 'Staking functionality will be available soon with the new Web3 stack',
    })
    return null
  }, [address, isConnected])

  /**
   * Unstake tokens
   */
  const unstakeTokens = useCallback(async (
    amount: string,
    poolId: string
  ): Promise<string | null> => {
    if (!address || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to unstake tokens',
        variant: 'destructive',
      })
      return null
    }

    // TODO: Implement unstaking with wagmi writeContract
    toast({
      title: 'Unstaking Coming Soon',
      description: 'Unstaking functionality will be available soon with the new Web3 stack',
    })
    return null
  }, [address, isConnected])

  /**
   * Claim staking rewards
   */
  const claimRewards = useCallback(async (
    poolId: string
  ): Promise<string | null> => {
    if (!address || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to claim rewards',
        variant: 'destructive',
      })
      return null
    }

    // TODO: Implement claim rewards with wagmi writeContract
    toast({
      title: 'Reward Claiming Coming Soon',
      description: 'Reward claiming functionality will be available soon with the new Web3 stack',
    })
    return null
  }, [address, isConnected])

  return {
    sendTransaction,
    sendNativeToken,
    sendToken,
    stakeTokens,
    unstakeTokens,
    claimRewards,
    isLoading: isLoading || combinedIsLoading,
    pendingTx: pendingTx || combinedHash,
  }
}