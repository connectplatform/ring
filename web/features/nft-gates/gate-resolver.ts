/**
 * GateResolver — hasFeature with entitlement cache + RPC collection verify.
 * Never trust DB alone when collectionMint is configured (truth-lens).
 *
 * Note: React cache() is request-scoped — after stake/unstake, callers must
 * revalidatePath so the next request sees fresh entitlements.
 */

import 'server-only'

import { cache } from 'react'
import { getNftCollectionMint } from './config'
import { listActiveStakes, listEntitlementCache } from './gate-escrow'
import { verifyAssetInCollection } from './metaplex-core'
import type { NftGateFeature } from './types'
import { findActiveListingByAsset } from '@/features/nft-market/listing-policy'

export const hasFeature = cache(async (userId: string, feature: NftGateFeature): Promise<boolean> => {
  const collection = getNftCollectionMint()
  const cached = await listEntitlementCache(userId)
  const hit = cached.find((e) => e.feature === feature)
  if (hit) {
    const verified = await verifyAssetInCollection(hit.sourceAsset)
    if (verified.ok) {
      const listed = await findActiveListingByAsset(hit.sourceAsset)
      if (listed) return false
      const stakes = await listActiveStakes(userId)
      const active = stakes.some(
        (s) =>
          s.asset === hit.sourceAsset &&
          s.features.includes(feature) &&
          (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now()),
      )
      if (active) return true
    }
  }

  const stakes = await listActiveStakes(userId)
  const now = Date.now()
  for (const stake of stakes) {
    if (stake.expiresAt && new Date(stake.expiresAt).getTime() <= now) continue
    if (!stake.features.includes(feature)) continue

    const verified = await verifyAssetInCollection(stake.asset)
    if (!verified.ok) {
      if (collection) continue
      if (!stake.asset.startsWith('gate_')) continue
    }
    const listed = await findActiveListingByAsset(stake.asset)
    if (listed) continue
    return true
  }

  return false
})

/**
 * Scoped unlock for vendor ERP / DAGI tools.
 * Secondary market: stake rebinds vendorEntityId to the new owner's entity —
 * never unlock the previous vendor from mint attrs alone.
 */
export const hasFeatureForVendor = cache(
  async (
    userId: string,
    vendorEntityId: string,
    feature: NftGateFeature,
  ): Promise<boolean> => {
    const entityId = String(vendorEntityId || '').trim()
    if (!userId || !entityId) return false

    const collection = getNftCollectionMint()
    const stakes = await listActiveStakes(userId)
    const now = Date.now()

    for (const stake of stakes) {
      if (stake.expiresAt && new Date(stake.expiresAt).getTime() <= now) continue
      if (!stake.features.includes(feature)) continue
      if (stake.vendorEntityId !== entityId) continue

      const verified = await verifyAssetInCollection(stake.asset)
      if (!verified.ok) {
        if (collection) continue
        if (!stake.asset.startsWith('gate_')) continue
      }
      const listed = await findActiveListingByAsset(stake.asset)
      if (listed) continue
      return true
    }

    return false
  },
)

export async function listUnlockedFeatures(userId: string): Promise<NftGateFeature[]> {
  const features = new Set<NftGateFeature>()
  const candidates: NftGateFeature[] = [
    'membership.member',
    'vendor.dagi',
    'vendor.deed',
    'vendor.license.annual',
    'vendor.license.quarterly',
  ]
  for (const f of candidates) {
    if (await hasFeature(userId, f)) features.add(f)
  }
  return [...features]
}

export async function canListGateAsset(userId: string, asset: string): Promise<boolean> {
  const stakes = await listActiveStakes(userId)
  if (stakes.some((stake) => stake.asset === asset)) return false
  const listed = await findActiveListingByAsset(asset)
  return !listed
}
