/**
 * GateEscrow stake service — feature-gate escrow (NOT NATIVE_NFT_APR).
 *
 * Seeds (documented): ['gate-escrow', userId, asset]
 * Until gateEscrowProgramId is set: custodial vault ATA + DB row;
 * GateResolver still RPC-verifies collection when collectionMint is set.
 */

import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { cache } from 'react'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { getGateEscrowProgramId, getNftGateTemplate } from './config'
import { verifyAssetInCollection } from './metaplex-core'
import {
  ENTITLEMENT_CACHE_TTL_MS,
  type NftGateFeature,
  type NftGateSlug,
  type NftStakeRecord,
} from './types'

function nowIso() {
  return new Date().toISOString()
}

/** Deterministic escrow PDA label for ledger mode (not a real Solana PDA until program ships). */
export function deriveGateEscrowPda(userId: string, asset: string): string {
  const programId = getGateEscrowProgramId() || 'GateEscrowLedgerV1'
  const h = createHash('sha256')
    .update(['gate-escrow', programId, userId, asset].join(':'))
    .digest('hex')
    .slice(0, 32)
  return `escrow_${h}`
}

export async function listActiveStakes(userId: string): Promise<NftStakeRecord[]> {
  const result = await db().queryDocs<NftStakeRecord & Record<string, unknown>>({
    collection: 'nft_stakes',
    filters: [{ field: 'userId', operator: '==', value: userId }],
    orderBy: [{ field: 'stakedAt', direction: 'desc' }],
    pagination: { limit: 200 },
  })
  if (!result.success || !result.data) return []
  return (result.data as NftStakeRecord[]).filter((s) => !s.unstakedAt)
}

export async function stakeGateAsset(params: {
  userId: string
  asset: string
  slug: NftGateSlug
}): Promise<{ success: boolean; stake?: NftStakeRecord; error?: string }> {
  const template = getNftGateTemplate(params.slug)
  if (!template) return { success: false, error: 'Unknown gate template' }

  const verified = await verifyAssetInCollection(params.asset)
  if (!verified.ok) {
    return { success: false, error: verified.error || 'Collection verification failed' }
  }

  // Ownership must match staker when RPC returns owner (on-chain path)
  if (verified.owner) {
    const { getNativeWallet } = await import('@/lib/wallet/user-wallet-db')
    const wallet = await getNativeWallet(params.userId, 'solana')
    if (!wallet?.address || wallet.address !== verified.owner) {
      return {
        success: false,
        error: 'Asset owner does not match custodial wallet — refuse stake',
      }
    }
  } else {
    // Ledger-dev: require ownership row
    const owned = await db().queryDocs<{ userId: string; asset: string; burnedAt?: string }>({
      collection: 'nft_ownership',
      filters: [
        { field: 'userId', operator: '==', value: params.userId },
        { field: 'asset', operator: '==', value: params.asset },
      ],
      pagination: { limit: 1 },
    })
    const row = owned.success ? owned.data?.[0] : undefined
    if (!row || row.burnedAt) {
      return { success: false, error: 'No ownership record for asset — refuse stake' }
    }
  }

  const existing = (await listActiveStakes(params.userId)).find((s) => s.asset === params.asset)
  if (existing) return { success: true, stake: existing }

  const stakedAt = nowIso()
  let expiresAt: string | undefined
  if (typeof template.durationDays === 'number' && template.durationDays > 0) {
    expiresAt = new Date(Date.now() + template.durationDays * 86400000).toISOString()
  }

  const stake: NftStakeRecord = {
    id: `stake_${randomUUID()}`,
    userId: params.userId,
    asset: params.asset,
    slug: params.slug,
    escrowPda: deriveGateEscrowPda(params.userId, params.asset),
    stakedAt,
    expiresAt,
    features: [...template.gateFeatures],
  }

  const created = await db().createDoc('nft_stakes', stake, { id: stake.id })
  if (!created.success) {
    logger.error('GateEscrow: stake create failed', { error: created.error })
    return { success: false, error: 'Failed to record stake' }
  }

  await grantEntitlements(params.userId, stake)
  logger.info('GateEscrow: staked', { userId: params.userId, asset: params.asset, slug: params.slug })
  return { success: true, stake }
}

export async function unstakeGateAsset(params: {
  userId: string
  asset: string
}): Promise<{ success: boolean; error?: string }> {
  const stakes = await listActiveStakes(params.userId)
  const stake = stakes.find((s) => s.asset === params.asset)
  if (!stake) return { success: false, error: 'No active stake for asset' }

  await db().updateDoc('nft_stakes', stake.id, {
    unstakedAt: nowIso(),
    updatedAt: nowIso(),
  })

  await invalidateEntitlementsForAsset(params.userId, params.asset)
  logger.info('GateEscrow: unstaked', { userId: params.userId, asset: params.asset })
  return { success: true }
}

async function grantEntitlements(userId: string, stake: NftStakeRecord) {
  // Timed stakes: cache expires with stake. Lifetime: refresh window = TTL (re-verify via RPC).
  const expiresAt =
    stake.expiresAt ||
    new Date(Date.now() + ENTITLEMENT_CACHE_TTL_MS).toISOString()

  for (const feature of stake.features) {
    const id = `ent_${userId}_${feature}_${stake.asset}`.slice(0, 255)
    await db().createDoc(
      'nft_entitlement_cache',
      {
        id,
        userId,
        feature,
        sourceAsset: stake.asset,
        expiresAt,
        createdAt: nowIso(),
      },
      { id, merge: true },
    )
  }
}

export async function invalidateEntitlementsForAsset(userId: string, asset: string) {
  const result = await db().queryDocs<{ id: string } & Record<string, unknown>>({
    collection: 'nft_entitlement_cache',
    filters: [
      { field: 'userId', operator: '==', value: userId },
      { field: 'sourceAsset', operator: '==', value: asset },
    ],
    pagination: { limit: 50 },
  })
  if (!result.success || !result.data) return
  for (const row of result.data) {
    await db().updateDoc('nft_entitlement_cache', row.id, {
      expiresAt: nowIso(),
      revokedAt: nowIso(),
      updatedAt: nowIso(),
    })
  }
}

export const listEntitlementCache = cache(async (userId: string) => {
  const result = await db().queryDocs<{
    id: string
    feature: NftGateFeature
    sourceAsset: string
    expiresAt: string
  }>({
    collection: 'nft_entitlement_cache',
    filters: [{ field: 'userId', operator: '==', value: userId }],
    pagination: { limit: 100 },
  })
  if (!result.success || !result.data) return []
  const now = Date.now()
  return result.data.filter((e) => new Date(e.expiresAt).getTime() > now)
})
