import 'server-only'

import { createHash, randomUUID } from 'crypto'
import {
  getGateMarketProgramId,
  getMarketplaceFeeBps,
} from '@/features/nft-gates/config'
import { transferNativeTokenForUser } from '@/features/wallet/chains/native-token-transfer-service'
import type { NftMarketListing } from '@/features/nft-market/types'

function hasProgramId() {
  return Boolean(getGateMarketProgramId())
}

export function deriveGateMarketListingPda(asset: string): string {
  const programId = getGateMarketProgramId() || 'GateMarketLedgerV1'
  const digest = createHash('sha256')
    .update(['gate-listing', programId, asset].join(':'))
    .digest('hex')
    .slice(0, 32)
  return `market_${digest}`
}

export function splitMarketplaceFee(priceRaw: string, feeBps = getMarketplaceFeeBps()) {
  const price = BigInt(priceRaw)
  const fee = (price * BigInt(feeBps)) / 10_000n
  return {
    feeRaw: fee.toString(),
    sellerProceedsRaw: (price - fee).toString(),
  }
}

export const SolanaMarketClient = {
  async listGate(input: {
    asset: string
    sellerWallet?: string
  }): Promise<{ mode: 'ledger-dev' | 'metaplex-core'; listingPda: string; signature: string }> {
    if (hasProgramId()) {
      throw new Error('GateMarket Anchor listing is not implemented in this build')
    }
    const listingPda = deriveGateMarketListingPda(input.asset)
    return {
      mode: 'ledger-dev',
      listingPda,
      signature: `ledger:list:${listingPda}:${randomUUID()}`,
    }
  },

  async cancelGate(input: {
    listing: NftMarketListing
    sellerUserId: string
  }): Promise<{ mode: 'ledger-dev' | 'metaplex-core'; signature: string }> {
    if (hasProgramId()) {
      throw new Error('GateMarket Anchor cancel is not implemented in this build')
    }
    if (input.listing.sellerUserId !== input.sellerUserId) {
      throw new Error('Only the seller can cancel this listing')
    }
    return {
      mode: 'ledger-dev',
      signature: `ledger:cancel:${input.listing.id}:${randomUUID()}`,
    }
  },

  async buyGate(input: {
    listing: NftMarketListing
    buyerUserId: string
    buyerWallet?: string
    idempotencyKey: string
  }): Promise<{
    mode: 'ledger-dev' | 'metaplex-core'
    signature: string
    feeRaw: string
    sellerProceedsRaw: string
  }> {
    const { feeRaw, sellerProceedsRaw } = splitMarketplaceFee(input.listing.priceRaw, input.listing.feeBps)

    if (hasProgramId()) {
      throw new Error('GateMarket Anchor buy is not implemented in this build')
    }
    if (!input.listing.sellerWallet) {
      throw new Error('Seller wallet is required for ledger-dev settlement')
    }

    // Ledger-dev: ONE RING transfer of full priceRaw to the seller.
    // Dual transfer (proceeds + fee) is non-atomic and can strand funds if the
    // fee leg fails. Protocol fee split is recorded for disclosure/accounting;
    // true atomic seller+Squads fee CPI lands with audited GateMarket.
    const payment = await transferNativeTokenForUser({
      userId: input.buyerUserId,
      toAddress: input.listing.sellerWallet,
      amount: input.listing.priceRaw,
    })

    return {
      mode: 'ledger-dev',
      signature: payment.txHash,
      feeRaw,
      sellerProceedsRaw,
    }
  },
}
