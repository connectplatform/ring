'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import type { NFTItemRef } from '@/features/nft-market/types'

interface MarketplaceConfig {
  address: `0x${string}`
  abi: any[]
}

interface UseNftMarketplaceProps {
  marketConfig: MarketplaceConfig
}

/**
 * Hook for NFT marketplace write operations using wagmi
 */
export function useNftMarketplace({ marketConfig }: UseNftMarketplaceProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const list = async (item: NFTItemRef, priceWei: bigint): Promise<{ txHash: string }> => {
    setIsLoading(true)
    try {
      const method = item.standard === 'ERC1155' ? 'list1155' : 'list721'

      writeContract({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: method,
        args: [item.address, item.tokenId, priceWei],
      } as any)

      // Wait for hash to be available
      await new Promise(resolve => setTimeout(resolve, 100))

      if (hash) {
        setPendingTx(hash)
        toast({
          title: 'NFT Listed',
          description: `Transaction submitted: ${hash.slice(0, 10)}...`,
        })
        return { txHash: hash }
      }

      throw new Error('Transaction hash not generated')
    } catch (err: any) {
      console.error('NFT listing error:', err)
      toast({
        title: 'Listing Failed',
        description: err.message || 'Failed to list NFT',
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const buy = async (listingId: string, valueWei: bigint): Promise<{ txHash: string }> => {
    setIsLoading(true)
    try {
      writeContract({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: 'buy',
        args: [listingId],
        value: valueWei,
      } as any)

      await new Promise(resolve => setTimeout(resolve, 100))

      if (hash) {
        setPendingTx(hash)
        toast({
          title: 'Purchase Submitted',
          description: `Transaction submitted: ${hash.slice(0, 10)}...`,
        })
        return { txHash: hash }
      }

      throw new Error('Transaction hash not generated')
    } catch (err: any) {
      console.error('NFT purchase error:', err)
      toast({
        title: 'Purchase Failed',
        description: err.message || 'Failed to purchase NFT',
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const cancel = async (listingId: string): Promise<{ txHash: string }> => {
    setIsLoading(true)
    try {
      writeContract({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: 'cancel',
        args: [listingId],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 100))

      if (hash) {
        setPendingTx(hash)
        toast({
          title: 'Listing Cancelled',
          description: `Transaction submitted: ${hash.slice(0, 10)}...`,
        })
        return { txHash: hash }
      }

      throw new Error('Transaction hash not generated')
    } catch (err: any) {
      console.error('NFT cancel error:', err)
      toast({
        title: 'Cancellation Failed',
        description: err.message || 'Failed to cancel listing',
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    list,
    buy,
    cancel,
    isLoading: isLoading || isPending || isConfirming,
    isConfirming,
    isSuccess,
    error,
    pendingTx,
  }
}
