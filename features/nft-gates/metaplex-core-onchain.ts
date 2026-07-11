/**
 * On-chain Metaplex Core helpers (SSOT: createCollection + create/mintAsset).
 * Sponsor feePayer via umi identity — buyer need not hold SOL.
 *
 * API note: mpl-core exports `create` (not mintAsset) and `fetchAsset` (not getAsset).
 */

import 'server-only'

import {
  create,
  createCollection,
  fetchAsset,
  fetchCollection,
  updateCollection,
} from '@metaplex-foundation/mpl-core'
import { generateSigner, publicKey } from '@metaplex-foundation/umi'
import { base58 } from '@metaplex-foundation/umi/serializers'
import { logger } from '@/lib/logger'
import type { NftGateTemplate } from '@/lib/ring-config-types'
import { createSponsorUmi } from './umi-client'
import { assertFeePayerGasReserve } from '@/features/wallet/chains/solana/solana-gas-reserve'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

function signatureToBase58(sig: Uint8Array): string {
  return base58.deserialize(sig)[0]
}

function assetInCollection(
  updateAuthority: { type: string; address?: string | { toString(): string } },
  collectionMint: string,
): boolean {
  if (updateAuthority.type !== 'Collection') return false
  const addr = updateAuthority.address?.toString?.() ?? String(updateAuthority.address ?? '')
  return addr === collectionMint
}

/**
 * Create a Metaplex Core verified collection (admin bootstrap).
 * Store returned address in ring-config `nft.collectionMint`.
 * Mainnet: migrate update authority to Squads before go-live.
 */
export async function createMetaplexCoreCollection(params: {
  name: string
  uri: string
}): Promise<{
  success: boolean
  collectionMint?: string
  signature?: string
  error?: string
}> {
  try {
    await assertFeePayerGasReserve(getNativeTokenSymbol())
    const umi = createSponsorUmi()
    const collection = generateSigner(umi)

    const tx = await createCollection(umi, {
      collection,
      name: params.name,
      uri: params.uri,
      plugins: [
        {
          type: 'VerifiedCreators',
          signatures: [
            {
              address: umi.identity.publicKey,
              verified: true,
            },
          ],
        },
      ],
    }).sendAndConfirm(umi)

    const signature = signatureToBase58(tx.signature)
    logger.info('Metaplex Core: collection created', {
      collection: collection.publicKey.toString(),
      signature,
    })

    return {
      success: true,
      collectionMint: collection.publicKey.toString(),
      signature,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Metaplex Core: createCollection failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * Update Metaplex Core collection name and/or uri (requires current update authority).
 * Symbol lives only in off-chain JSON at `uri` — Core has no on-chain symbol field.
 */
export async function updateMetaplexCoreCollection(params: {
  collectionMint: string
  name?: string
  uri?: string
}): Promise<{
  success: boolean
  signature?: string
  error?: string
}> {
  if (!params.name?.trim() && !params.uri?.trim()) {
    return { success: false, error: 'name or uri required' }
  }

  try {
    await assertFeePayerGasReserve(getNativeTokenSymbol())
    const umi = createSponsorUmi()
    const collection = publicKey(params.collectionMint)

    // Confirm authority before send — clearer error than program reject
    const onChain = await fetchCollection(umi, collection)
    const authority = onChain.updateAuthority?.toString?.() ?? String(onChain.updateAuthority)
    const identity = umi.identity.publicKey.toString()
    if (authority !== identity) {
      return {
        success: false,
        error: `Update authority mismatch: collection authority ${authority} ≠ sponsor ${identity}. Recreate collection or use the authority key.`,
      }
    }

    const tx = await updateCollection(umi, {
      collection,
      ...(params.name?.trim() ? { name: params.name.trim().slice(0, 32) } : {}),
      ...(params.uri?.trim() ? { uri: params.uri.trim() } : {}),
    }).sendAndConfirm(umi)

    const signature = signatureToBase58(tx.signature)
    logger.info('Metaplex Core: collection updated', {
      collection: params.collectionMint,
      name: params.name,
      uri: params.uri,
      signature,
    })

    return { success: true, signature }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Metaplex Core: updateCollection failed', { error: message })
    return { success: false, error: message }
  }
}

export async function mintMetaplexCoreAsset(params: {
  collectionMint: string
  template: NftGateTemplate
  ownerPubkey: string
  metadataUri: string
}): Promise<{
  success: boolean
  asset?: string
  signature?: string
  mode: 'metaplex-core'
  error?: string
}> {
  try {
    await assertFeePayerGasReserve(getNativeTokenSymbol())
    const umi = createSponsorUmi()

    let collection
    try {
      collection = await fetchCollection(umi, publicKey(params.collectionMint))
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : String(fetchError)
      return {
        success: false,
        mode: 'metaplex-core',
        error: `Collection ${params.collectionMint} not found on RPC: ${message}`,
      }
    }

    const asset = generateSigner(umi)
    const plugins: NonNullable<Parameters<typeof create>[1]['plugins']> = [
      {
        type: 'Attributes',
        attributeList: [
          { key: 'slug', value: params.template.slug },
          { key: 'gateFeatures', value: params.template.gateFeatures.join(',') },
          { key: 'soulbound', value: String(params.template.soulbound) },
        ],
      },
    ]

    // Membership / soulbound SKUs: PermanentFreezeDelegate (truth-lens soulbound)
    if (params.template.soulbound) {
      plugins.push({
        type: 'PermanentFreezeDelegate',
        frozen: true,
        authority: { type: 'UpdateAuthority' },
      })
    }

    const tx = await create(umi, {
      asset,
      collection,
      owner: publicKey(params.ownerPubkey),
      name: params.template.name.slice(0, 32),
      uri: params.metadataUri,
      plugins,
    }).sendAndConfirm(umi)

    const signature = signatureToBase58(tx.signature)
    const assetAddress = asset.publicKey.toString()

    logger.info('Metaplex Core: asset minted', {
      asset: assetAddress,
      collection: params.collectionMint,
      owner: params.ownerPubkey,
      slug: params.template.slug,
      signature,
    })

    return {
      success: true,
      asset: assetAddress,
      signature,
      mode: 'metaplex-core',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Metaplex Core mint failed', {
      error: message,
      slug: params.template.slug,
      collection: params.collectionMint,
    })
    return {
      success: false,
      mode: 'metaplex-core',
      error: message,
    }
  }
}

export async function verifyMetaplexCoreCollection(params: {
  asset: string
  collectionMint: string
}): Promise<{ ok: boolean; error?: string; owner?: string }> {
  if (params.asset.startsWith('gate_')) {
    return { ok: false, error: 'Ledger-dev asset rejected when collectionMint is set' }
  }

  try {
    const umi = createSponsorUmi()
    const asset = await fetchAsset(umi, publicKey(params.asset))
    const ua = asset.updateAuthority

    if (!assetInCollection(ua, params.collectionMint)) {
      return {
        ok: false,
        error: `Asset updateAuthority is not collection ${params.collectionMint} (got ${ua.type}:${ua.address ?? 'n/a'})`,
      }
    }

    return {
      ok: true,
      owner: asset.owner.toString(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: `fetchAsset failed: ${message}`,
    }
  }
}

/** Prefetch collection existence (preflight before RING payment). */
export async function assertCollectionExists(collectionMint: string): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    const umi = createSponsorUmi()
    await fetchCollection(umi, publicKey(collectionMint))
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `Collection ${collectionMint} unreachable`,
    }
  }
}
