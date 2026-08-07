'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import type { NFTItemRef } from '@/features/nft-market/types'

interface MarketplaceConfig {
  address: `0x${string}`
  abi: readonly unknown[] | unknown[]
}

interface UseNftMarketplaceProps {
  marketConfig: MarketplaceConfig
}

/**
 * Hook for NFT marketplace write operations using wagmi v3 mutation API
 */
export function useNftMarketplace({ marketConfig }: UseNftMarketplaceProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [pendingTx, setPendingTx] = useState<string | null>(null)

  const write = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error } = useWaitForTransactionReceipt({
    hash: write.data,
  })

  const list = async (item: NFTItemRef, priceWei: bigint): Promise<{ txHash: string }> => {
    setIsLoading(true)
    try {
      const method = item.standard === 'ERC1155' ? 'list1155' : 'list721'

      const hash = await write.mutateAsync({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: method,
        args: [item.address, item.tokenId, priceWei],
      } as never)

      setPendingTx(hash)
      toast({
        title: 'NFT Listed',
        description: `Transaction submitted: ${hash.slice(0, 10)}...`,
      })
      return { txHash: hash }
    } catch (err: unknown) {
      console.error('NFT listing error:', err)
      const message = err instanceof Error ? err.message : 'Failed to list NFT'
      toast({
        title: 'Listing Failed',
        description: message,
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
      const hash = await write.mutateAsync({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: 'buy',
        args: [listingId],
        value: valueWei,
      } as never)

      setPendingTx(hash)
      toast({
        title: 'Purchase Submitted',
        description: `Transaction submitted: ${hash.slice(0, 10)}...`,
      })
      return { txHash: hash }
    } catch (err: unknown) {
      console.error('NFT purchase error:', err)
      const message = err instanceof Error ? err.message : 'Failed to purchase NFT'
      toast({
        title: 'Purchase Failed',
        description: message,
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
      const hash = await write.mutateAsync({
        address: marketConfig.address,
        abi: marketConfig.abi,
        functionName: 'cancel',
        args: [listingId],
      } as never)

      setPendingTx(hash)
      toast({
        title: 'Listing Cancelled',
        description: `Transaction submitted: ${hash.slice(0, 10)}...`,
      })
      return { txHash: hash }
    } catch (err: unknown) {
      console.error('NFT cancel error:', err)
      const message = err instanceof Error ? err.message : 'Failed to cancel listing'
      toast({
        title: 'Cancellation Failed',
        description: message,
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
    isLoading: isLoading || write.isPending || isConfirming,
    isConfirming,
    isSuccess,
    error,
    pendingTx,
  }
}
