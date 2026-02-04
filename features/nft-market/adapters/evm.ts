import type { Listing, NFTItemRef } from '../types'

type EthersLikeSigner = any
type EthersLikeContract = any

export interface EvmMarketplaceConfig {
  marketContract: { address: string, abi: any[] }
  erc721Abi?: any[]
  erc1155Abi?: any[]
  getSigner: () => Promise<EthersLikeSigner | null>
}

import { createPublicClient, http } from 'viem'
import { polygon } from 'viem/chains'

// Public client for read operations
const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
})

// Read operations using viem (server-safe)
async function executeContractRead(config: {
  address: `0x${string}`
  abi: any[]
  functionName: string
  args?: any[]
}): Promise<any> {
  return await publicClient.readContract(config as any)
}

// For write operations, we need to use wagmi hooks in React components
// This adapter now provides read-only functionality for server-side use
// Write operations should be handled by React components using wagmi hooks

// Write operations require wagmi hooks in React components
// Use the useNftMarketplace hook for write operations
export interface NftMarketplaceWriteOperations {
  list: (item: NFTItemRef, priceWei: bigint) => Promise<{ txHash: string }>
  buy: (listingId: string, valueWei: bigint) => Promise<{ txHash: string }>
  cancel: (listingId: string) => Promise<{ txHash: string }>
}

export function createEvmMarketplaceAdapter(cfg: EvmMarketplaceConfig) {
  return {
    // Write operations - these require wagmi hooks and should be used in React components
    async list(item: NFTItemRef, priceWei: bigint): Promise<{ txHash: string }> {
      throw new Error('Use useNftMarketplace hook in React components for write operations')
    },

    async buy(listingId: string, valueWei: bigint): Promise<{ txHash: string }> {
      throw new Error('Use useNftMarketplace hook in React components for write operations')
    },

    async cancel(listingId: string): Promise<{ txHash: string }> {
      throw new Error('Use useNftMarketplace hook in React components for write operations')
    },

    async getListing(listingId: string): Promise<any> {
      return await executeContractRead({
        address: cfg.marketContract.address as `0x${string}`,
        abi: cfg.marketContract.abi,
        functionName: 'getListing',
        args: [listingId],
      })
    },

    async getListings(filters?: any): Promise<any[]> {
      return await executeContractRead({
        address: cfg.marketContract.address as `0x${string}`,
        abi: cfg.marketContract.abi,
        functionName: 'getListings',
        args: [filters || {}],
      })
    }
  }
}


