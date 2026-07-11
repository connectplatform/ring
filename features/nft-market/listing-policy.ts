import 'server-only'

import { db } from '@/lib/database'
import {
  getNftCollectionMint,
  getNftCollectionSymbol,
  getNftGateTemplateResolved,
  isNftMarketplaceEnabled,
} from '@/features/nft-gates/config'
import { listActiveStakes } from '@/features/nft-gates/gate-escrow'
import { verifyAssetInCollection } from '@/features/nft-gates/metaplex-core'
import type { NftGateSlug, NftOwnershipRecord } from '@/features/nft-gates/types'

export const TRADEABLE_GATE_SLUGS = [
  'vendor-store-deed',
  'vendor-dagi-key',
  'vendor-annual-store-license',
  'vendor-quarterly-store-license',
] as const satisfies readonly NftGateSlug[]

export type TradeableGateSlug = (typeof TRADEABLE_GATE_SLUGS)[number]

export function isTradeableGateSlug(slug: string): slug is TradeableGateSlug {
  return (TRADEABLE_GATE_SLUGS as readonly string[]).includes(slug)
}

export async function findActiveListingByAsset(asset: string) {
  const result = await db().queryDocs({
    collection: 'nft_listings',
    filters: [
      { field: 'asset', operator: '==', value: asset },
      { field: 'status', operator: '==', value: 'active' },
      { field: 'chainFamily', operator: '==', value: 'solana' },
    ],
    pagination: { limit: 1 },
  })
  return result.success ? result.data?.[0] ?? null : null
}

export async function assertGateCanBeListed(params: {
  userId: string
  asset: string
  slug: string
}): Promise<{
  ok: boolean
  error?: string
  ownership?: NftOwnershipRecord
}> {
  if (!isNftMarketplaceEnabled()) {
    return { ok: false, error: 'NFT marketplace is disabled' }
  }

  if (!isTradeableGateSlug(params.slug)) {
    return { ok: false, error: 'This NFT gate SKU is not tradeable' }
  }

  const template = await getNftGateTemplateResolved(params.slug)
  if (!template) {
    return { ok: false, error: 'Unknown NFT gate template' }
  }
  if (template.soulbound) {
    return { ok: false, error: 'Soulbound NFT gates cannot be listed' }
  }
  if (getNftCollectionSymbol() !== 'KEYS') {
    return { ok: false, error: 'Marketplace only accepts the KEYS collection' }
  }

  const verified = await verifyAssetInCollection(params.asset)
  if (!verified.ok) {
    return { ok: false, error: verified.error || 'Asset is not in the verified collection' }
  }

  const stakes = await listActiveStakes(params.userId)
  if (stakes.some((stake) => stake.asset === params.asset)) {
    return { ok: false, error: 'Staked NFT gates must be unstaked before listing' }
  }

  const existingListing = await findActiveListingByAsset(params.asset)
  if (existingListing) {
    return { ok: false, error: 'Asset already has an active listing' }
  }

  const owned = await db().queryDocs<NftOwnershipRecord>({
    collection: 'nft_ownership',
    filters: [
      { field: 'userId', operator: '==', value: params.userId },
      { field: 'asset', operator: '==', value: params.asset },
      { field: 'slug', operator: '==', value: params.slug },
    ],
    pagination: { limit: 1 },
  })
  const ownership = owned.success ? owned.data?.[0] : undefined
  if (!ownership || ownership.burnedAt) {
    return { ok: false, error: 'No active ownership record for this gate asset' }
  }
  if (ownership.soulbound) {
    return { ok: false, error: 'Soulbound ownership records cannot be listed' }
  }

  const configuredCollection = getNftCollectionMint()
  if (configuredCollection && ownership.collectionMint && ownership.collectionMint !== configuredCollection) {
    return { ok: false, error: 'Ownership collection does not match the verified marketplace collection' }
  }

  return { ok: true, ownership }
}
