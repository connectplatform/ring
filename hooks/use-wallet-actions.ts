'use client'

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWeb3 } from '@/contexts/web3-context'
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
  const { provider, signer, address, isConnected, chainId } = useWeb3()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<string | null>(null)

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
    if (!signer || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet to send tokens',
        variant: 'destructive',
      })
      return null
    }

    setIsLoading(true)
    try {
      const tx = await signer.sendTransaction({
        to: recipient,
        value: ethers.parseEther(amount),
        gasLimit: DEFAULT_GAS_LIMIT,
      })

      setPendingTx(tx.hash)
      
      toast({
        title: 'Transaction Submitted',
        description: `Transaction submitted. View on Polygonscan: ${getPolygonscanUrl(tx.hash)}`,
      })

      // Record transaction
      await recordTransaction(tx.hash, recipient, amount, 'POL', 'send', notes)

      // Wait for confirmation
      const receipt = await tx.wait()
      
      if (receipt && receipt.status === 1) {
        await updateTransactionStatus(tx.hash, 'success')
        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${amount} POL to ${recipient.slice(0, 8)}...${recipient.slice(-6)}`,
        })
        return tx.hash
      } else {
        await updateTransactionStatus(tx.hash, 'failed')
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Send transaction error:', error)
      
      let errorMessage = 'Failed to send transaction'
      if (error?.code === 'ACTION_REJECTED' || error?.code === 4001) {
        errorMessage = 'Transaction rejected by user'
      } else if (error?.reason) {
        errorMessage = error.reason
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
  }, [signer, isConnected, recordTransaction, updateTransactionStatus])

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
    if (!signer || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet to send tokens',
        variant: 'destructive',
      })
      return null
    }

    setIsLoading(true)
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address) view returns (uint256)',
        ],
        signer
      )

      // Check balance
      const balance = await tokenContract.balanceOf(address)
      const amountWei = ethers.parseUnits(amount, decimals)
      
      if (balance < amountWei) {
        throw new Error(`Insufficient ${tokenSymbol} balance`)
      }

      // Send transaction
      const tx = await tokenContract.transfer(recipient, amountWei)
      setPendingTx(tx.hash)
      
      toast({
        title: 'Transaction Submitted',
        description: `Transaction submitted. View on Polygonscan: ${getPolygonscanUrl(tx.hash)}`,
      })

      // Record transaction
      await recordTransaction(tx.hash, recipient, amount, tokenSymbol, 'send', notes)

      // Wait for confirmation
      const receipt = await tx.wait()
      
      if (receipt && receipt.status === 1) {
        await updateTransactionStatus(tx.hash, 'success')
        toast({
          title: 'Transaction Successful',
          description: `Successfully sent ${amount} ${tokenSymbol} to ${recipient.slice(0, 8)}...${recipient.slice(-6)}`,
        })
        return tx.hash
      } else {
        await updateTransactionStatus(tx.hash, 'failed')
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Send token error:', error)
      
      let errorMessage = 'Failed to send tokens'
      if (error?.code === 'ACTION_REJECTED' || error?.code === 4001) {
        errorMessage = 'Transaction rejected by user'
      } else if (error?.reason) {
        errorMessage = error.reason
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
  }, [signer, isConnected, address, recordTransaction, updateTransactionStatus])

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
    if (!signer || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet to stake tokens',
        variant: 'destructive',
      })
      return null
    }

    if (!RING_STAKING_ADDRESS || RING_STAKING_ADDRESS === '0x0000000000000000000000000000000000000000') {
      toast({
        title: 'Staking not available',
        description: 'Staking contracts are not yet deployed',
        variant: 'destructive',
      })
      return null
    }

    setIsLoading(true)
    try {
      // First approve the staking contract to spend tokens
      const tokenContract = new ethers.Contract(
        RING_TOKEN_ADDRESS,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)',
        ],
        signer
      )

      const amountWei = ethers.parseEther(amount)
      
      // Check current allowance
      const allowance = await tokenContract.allowance(address, RING_STAKING_ADDRESS)
      
      if (allowance < amountWei) {
        // Approve spending
        const approveTx = await tokenContract.approve(RING_STAKING_ADDRESS, amountWei)
        
        toast({
          title: 'Approving tokens...',
          description: 'Please wait for approval confirmation',
        })
        
        await approveTx.wait()
      }

      // Now stake the tokens
      const stakingContract = new ethers.Contract(
        RING_STAKING_ADDRESS,
        ['function stake(uint256 amount) returns (bool)'],
        signer
      )

      const tx = await stakingContract.stake(amountWei)
      setPendingTx(tx.hash)
      
      toast({
        title: 'Staking Transaction Submitted',
        description: `Staking transaction submitted. View on Polygonscan: ${getPolygonscanUrl(tx.hash)}`,
      })

      // Record transaction
      await recordTransaction(tx.hash, RING_STAKING_ADDRESS, amount, 'RING', 'stake')

      // Wait for confirmation
      const receipt = await tx.wait()
      
      if (receipt && receipt.status === 1) {
        await updateTransactionStatus(tx.hash, 'success')
        toast({
          title: 'Staking Successful',
          description: `Successfully staked ${amount} RING tokens`,
        })
        return tx.hash
      } else {
        await updateTransactionStatus(tx.hash, 'failed')
        throw new Error('Staking transaction failed')
      }
    } catch (error: any) {
      console.error('Staking error:', error)
      
      let errorMessage = 'Failed to stake tokens'
      if (error?.code === 'ACTION_REJECTED' || error?.code === 4001) {
        errorMessage = 'Transaction rejected by user'
      } else if (error?.reason) {
        errorMessage = error.reason
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Staking Failed',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    } finally {
      setIsLoading(false)
      setPendingTx(null)
    }
  }, [signer, isConnected, address, recordTransaction, updateTransactionStatus])

  /**
   * Unstake tokens
   */
  const unstakeTokens = useCallback(async (
    amount: string,
    poolId: string
  ): Promise<string | null> => {
    if (!signer || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet to unstake tokens',
        variant: 'destructive',
      })
      return null
    }

    // Implementation similar to stakeTokens but calls unstake function
    // TODO: Implement unstaking logic
    toast({
      title: 'Coming Soon',
      description: 'Unstaking functionality will be available soon',
    })
    return null
  }, [signer, isConnected])

  /**
   * Claim staking rewards
   */
  const claimRewards = useCallback(async (
    poolId: string
  ): Promise<string | null> => {
    if (!signer || !isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet to claim rewards',
        variant: 'destructive',
      })
      return null
    }

    // TODO: Implement claim rewards logic
    toast({
      title: 'Coming Soon',
      description: 'Reward claiming functionality will be available soon',
    })
    return null
  }, [signer, isConnected])

  return {
    sendTransaction,
    sendNativeToken,
    sendToken,
    stakeTokens,
    unstakeTokens,
    claimRewards,
    isLoading,
    pendingTx,
  }
}