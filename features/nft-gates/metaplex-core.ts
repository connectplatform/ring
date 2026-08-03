/**
 * Metaplex Core mint adapter for Ring gate NFTs.
 *
 * SSOT: createCollection + create (mintAsset) via mpl-core.
 * When collectionMint is unset (local/dev), issues deterministic ledger asset ids
 * so primary-sale + GateEscrow flows can be smoke-tested without on-chain deploy.
 * When collectionMint is set, requires sponsor feePayer + live RPC mint/verify.
 */

import 'server-only'

import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { getNftCollectionMint, isSponsorFeePayerEnabled } from './config'
import type { NftGateTemplate } from '@/lib/ring-config-types'

export interface MintGateAssetInput {
  template: NftGateTemplate
  ownerPubkey: string
  metadataUri: string
  /** Admin/system authority context */
  mintAuthorityLabel?: string
}

export interface MintGateAssetResult {
  success: boolean
  asset?: string
  signature?: string
  mode: 'metaplex-core' | 'ledger-dev'
  error?: string
}

/**
 * Mint a gate asset into the verified collection for `ownerPubkey`.
 */
export async function mintGateAsset(input: MintGateAssetInput): Promise<MintGateAssetResult> {
  const collectionMint = getNftCollectionMint()

  if (!collectionMint) {
    // Dev/local ledger mint — never use on mainnet with empty collectionMint
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LEDGER_NFT_MINT !== '1') {
      return {
        success: false,
        mode: 'ledger-dev',
        error: 'nft.collectionMint not configured — refuse ledger mint in production',
      }
    }
    const asset = `gate_${input.template.slug}_${randomUUID().replace(/-/g, '').slice(0, 16)}`
    logger.info('Metaplex Core: ledger-dev mint (no collectionMint)', {
      asset,
      slug: input.template.slug,
      owner: input.ownerPubkey,
      label: input.mintAuthorityLabel,
    })
    return { success: true, asset, mode: 'ledger-dev', signature: `ledger:${asset}` }
  }

  if (!isSponsorFeePayerEnabled()) {
    return {
      success: false,
      mode: 'metaplex-core',
      error: 'Sponsor feePayer required for Metaplex Core mint (buyer must not pay SOL)',
    }
  }

  try {
    const { mintMetaplexCoreAsset } = await import('./metaplex-core-onchain')
    return await mintMetaplexCoreAsset({
      collectionMint,
      template: input.template,
      ownerPubkey: input.ownerPubkey,
      metadataUri: input.metadataUri,
    })
  } catch (error) {
    logger.error('Metaplex Core mint failed', { error, slug: input.template.slug })
    return {
      success: false,
      mode: 'metaplex-core',
      error: error instanceof Error ? error.message : 'Metaplex Core mint failed',
    }
  }
}

/**
 * RPC-verify asset belongs to configured collection.
 * Ledger-dev assets (gate_*) skip RPC when collectionMint unset.
 */
export async function verifyAssetInCollection(asset: string): Promise<{
  ok: boolean
  error?: string
  owner?: string
}> {
  const collectionMint = getNftCollectionMint()
  if (!collectionMint) {
    if (asset.startsWith('gate_')) return { ok: true }
    return { ok: false, error: 'collectionMint unset and asset is not ledger-dev' }
  }

  // Ops smoke hatch: when ALLOW_LEDGER_NFT_MINT=1, accept ledger-dev gate_* even if
  // collectionMint is configured (prod Metaplex path otherwise rejects them).
  // Do not leave this env enabled long-term on public clusters.
  if (asset.startsWith('gate_') && process.env.ALLOW_LEDGER_NFT_MINT === '1') {
    return { ok: true }
  }

  try {
    const { verifyMetaplexCoreCollection } = await import('./metaplex-core-onchain')
    return await verifyMetaplexCoreCollection({ asset, collectionMint })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'RPC collection verify failed',
    }
  }
}

/** Preflight: collection account exists before charging RING. */
export async function assertGateCollectionReady(): Promise<{ ok: boolean; error?: string }> {
  const collectionMint = getNftCollectionMint()
  if (!collectionMint) return { ok: true }
  const { assertCollectionExists } = await import('./metaplex-core-onchain')
  return assertCollectionExists(collectionMint)
}
