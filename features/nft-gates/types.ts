/**
 * NFT Gate types — Solana Metaplex Core MVP-A
 * Mint SSOT: Metaplex Core. Stake SSOT: GateEscrow (not NATIVE_NFT_APR).
 */

import type { NftGateFeature, NftGateSlug, NftGateTemplate } from '@/lib/ring-config-types'

export type { NftGateFeature, NftGateSlug, NftGateTemplate }

export interface NftOwnershipRecord {
  id: string
  userId: string
  asset: string
  /** Gate SKU or member mint slug (e.g. member-open). */
  slug: NftGateSlug | string
  collectionMint?: string
  /** Member collection row id when source is member_mint. */
  collectionId?: string
  /** Provenance: gate primary sale vs member creator mint. */
  source?: 'gate_purchase' | 'member_mint'
  name?: string
  description?: string
  metadataUri?: string
  soulbound: boolean
  purchaseId: string
  signature?: string
  priceRing: number
  imageUri?: string
  createdAt: string
  burnedAt?: string
}

export interface NftStakeRecord {
  id: string
  userId: string
  asset: string
  slug: NftGateSlug
  escrowPda: string
  stakedAt: string
  unstakedAt?: string
  expiresAt?: string
  features: NftGateFeature[]
}

export interface NftEntitlementCacheRecord {
  id: string
  userId: string
  feature: NftGateFeature
  sourceAsset: string
  expiresAt: string
  createdAt: string
}

export const ENTITLEMENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export const MEMBERSHIP_GATE_SLUGS: NftGateSlug[] = [
  'one-month-membership',
  'annual-membership',
  'lifetime-membership',
]
