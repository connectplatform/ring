"use client"

import marketAbi from '@/features/nft-market/abi/market.json'
import { createEvmMarketplaceAdapter } from '@/features/nft-market/adapters/evm'
import { DEFAULT_MARKET_CONFIG } from '@/features/nft-market/market.config'
import { toWeiDecimal } from '@/features/nft-market/utils'

export async function createListingOnChainAndActivateClient(
  draftId: string,
  item: { address: string; tokenId: string; standard: 'ERC721' | 'ERC1155' },
  priceAmount: string
) {
  const adapter = createEvmMarketplaceAdapter({
    marketContract: { address: DEFAULT_MARKET_CONFIG.addresses.MARKET, abi: marketAbi as any[] },
    getSigner: async () => {
      const { BrowserProvider } = await import('ethers')
      // @ts-ignore
      const provider = new BrowserProvider(window.ethereum)
      return provider.getSigner()
    }
  })

  const valueWei = await toWeiDecimal(priceAmount, 18)
  const res = await adapter.list({ address: item.address, tokenId: String(item.tokenId), standard: item.standard, chainId: 137 }, valueWei)

  await fetch('/api/nft-market/listings/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draftId, txHash: res.txHash })
  })

  return { txHash: res.txHash }
}


