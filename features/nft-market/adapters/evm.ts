import type { Listing, NFTItemRef } from '../types'

type EthersLikeSigner = any
type EthersLikeContract = any

export interface EvmMarketplaceConfig {
  marketContract: { address: string, abi: any[] }
  erc721Abi?: any[]
  erc1155Abi?: any[]
  getSigner: () => Promise<EthersLikeSigner | null>
}

async function toContract(address: string, abi: any[], signer: EthersLikeSigner): Promise<EthersLikeContract> {
  const { Contract } = await import('ethers')
  return new Contract(address, abi, signer)
}

export function createEvmMarketplaceAdapter(cfg: EvmMarketplaceConfig) {
  async function withSigner<T>(fn: (signer: EthersLikeSigner) => Promise<T>): Promise<T> {
    const signer = await cfg.getSigner()
    if (!signer) throw new Error('Wallet not connected')
    return fn(signer)
  }

  return {
    async list(item: NFTItemRef, priceWei: bigint): Promise<{ txHash: string }> {
      return withSigner(async (signer) => {
        const market = await toContract(cfg.marketContract.address, cfg.marketContract.abi, signer)
        const method = item.standard === 'ERC1155' ? 'list1155' : 'list721'
        const tx = await market[method](item.address, item.tokenId, priceWei)
        const receipt = await tx.wait()
        return { txHash: receipt?.hash || tx.hash }
      })
    },

    async buy(listingId: string, valueWei: bigint): Promise<{ txHash: string }> {
      return withSigner(async (signer) => {
        const market = await toContract(cfg.marketContract.address, cfg.marketContract.abi, signer)
        const tx = await market.buy(listingId, { value: valueWei })
        const receipt = await tx.wait()
        return { txHash: receipt?.hash || tx.hash }
      })
    },

    async cancel(listingId: string): Promise<{ txHash: string }> {
      return withSigner(async (signer) => {
        const market = await toContract(cfg.marketContract.address, cfg.marketContract.abi, signer)
        const tx = await market.cancel(listingId)
        const receipt = await tx.wait()
        return { txHash: receipt?.hash || tx.hash }
      })
    }
  }
}


