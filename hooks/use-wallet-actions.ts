'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useConnection, useSendTransaction } from 'wagmi'
import { parseEther, parseUnits, erc20Abi } from 'viem'
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
import { polygon } from 'viem/chains'

/**
 * Hook for wallet actions like sending tokens, staking, etc.
 */
export function useWalletActions() {
  const { address, isConnected, chainId } = useConnection()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<string | null>(null)

  // Wagmi v3: mutation hooks expose mutate / data on the hook return object
  const contractWrite = useWriteContract()
  const { isLoading: contractConfirming, isSuccess: contractConfirmed } = useWaitForTransactionReceipt({
    hash: contractWrite.data,
  })

  const sendTx = useSendTransaction()
  const { isLoading: sendConfirming, isSuccess: sendConfirmed } = useWaitForTransactionReceipt({
    hash: sendTx.data,
  })

  // Combined loading and error states
  const combinedIsLoading =
    contractWrite.isPending || contractConfirming || sendTx.isPending || sendConfirming
  const combinedHash = contractWrite.data || sendTx.data
  const combinedIsConfirmed = contractConfirmed || sendConfirmed
  const combinedError = contractWrite.error || sendTx.error

  // Sync confirmed receipts into the wallet history ledger
  useEffect(() => {
    if (combinedIsConfirmed && combinedHash) {
      updateTransactionStatus(combinedHash, 'success')
      toast({
        title: 'Transaction Confirmed',
        description: 'Your transaction was confirmed on-chain.',
      })
    }
  }, [combinedIsConfirmed, combinedHash]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // Wagmi v3: mutation object — mutateAsync resolves with the tx hash
      const txHash = await sendTx.mutateAsync({
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      })
      setPendingTx(txHash)

      toast({
        title: 'Transaction Submitted',
        description: `POL transfer submitted. View on Polygonscan once confirmed.`,
      })

      await recordTransaction(txHash, recipient, amount, 'POL', 'send', notes)

      return txHash
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
    }
  }, [address, isConnected, sendTx, recordTransaction])

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
      // Wagmi v3: writeContract mutation with viem erc20Abi
      const txHash = await contractWrite.mutateAsync({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, parseUnits(amount, decimals)],
        chain: polygon,
        account: address as `0x${string}`,
      })
      setPendingTx(txHash)

      toast({
        title: 'Transaction Submitted',
        description: `${tokenSymbol} transfer submitted. View on Polygonscan once confirmed.`,
      })

      await recordTransaction(txHash, recipient, amount, tokenSymbol, 'send', notes)

      return txHash
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
    }
  }, [address, isConnected, contractWrite, recordTransaction])

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