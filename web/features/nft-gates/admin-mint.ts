/**
 * Admin mint / activate template asset for a gate slug.
 * Price change = new activeTemplateAsset; never mutate sold assets.
 */

import 'server-only'

import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import { UserRolesArray } from '@/features/auth/user-role'
import {
  getNftCollectionMint,
  getNftCollectionName,
  getNftCollectionUri,
  getNftGateTemplate,
  isNftGatesEnabled,
} from './config'
import { mintGateAsset } from './metaplex-core'
import type { NftGateSlug } from './types'

function nowIso() {
  return new Date().toISOString()
}

export async function adminCreateGateCollection(params: {
  adminUserId: string
  name?: string
  uri?: string
}): Promise<{
  success: boolean
  collectionMint?: string
  signature?: string
  error?: string
}> {
  if (!isNftGatesEnabled()) {
    return { success: false, error: 'NFT gates disabled in ring-config' }
  }

  const { createMetaplexCoreCollection } = await import('./metaplex-core-onchain')
  const result = await createMetaplexCoreCollection({
    name: (params.name || getNftCollectionName()).slice(0, 32),
    uri: params.uri || getNftCollectionUri(),
  })

  if (result.success && result.collectionMint) {
    await db().createDoc(
      'nft_gates',
      {
        id: `collection_${result.collectionMint.slice(0, 16)}`,
        kind: 'collection',
        collectionMint: result.collectionMint,
        collectionUri: params.uri || getNftCollectionUri(),
        collectionSymbol: 'KEYS',
        signature: result.signature,
        activatedBy: params.adminUserId,
        activatedAt: nowIso(),
        note: 'Set nft.collectionMint in ring-config to this address. Migrate update authority to Squads before mainnet.',
      },
      { id: `collection_${result.collectionMint.slice(0, 16)}` },
    )
  }

  return result
}

/**
 * Point existing Core collection uri (+ optional name) at KEYS metadata JSON.
 * Requires sponsor fee payer to still be update authority.
 */
export async function adminUpdateGateCollectionMetadata(params: {
  adminUserId: string
  name?: string
  uri?: string
  collectionMint?: string
}): Promise<{
  success: boolean
  signature?: string
  collectionMint?: string
  uri?: string
  error?: string
}> {
  if (!isNftGatesEnabled()) {
    return { success: false, error: 'NFT gates disabled in ring-config' }
  }

  const collectionMint = params.collectionMint?.trim() || getNftCollectionMint()
  if (!collectionMint) {
    return { success: false, error: 'nft.collectionMint unset — create collection first' }
  }

  const uri = params.uri?.trim() || getNftCollectionUri()
  const name = (params.name?.trim() || getNftCollectionName()).slice(0, 32)

  const { updateMetaplexCoreCollection } = await import('./metaplex-core-onchain')
  const result = await updateMetaplexCoreCollection({
    collectionMint,
    name,
    uri,
  })

  if (result.success) {
    await db().createDoc(
      'nft_gates',
      {
        id: `collection_meta_${collectionMint.slice(0, 12)}_${Date.now()}`,
        kind: 'collection_metadata_update',
        collectionMint,
        collectionUri: uri,
        collectionSymbol: 'KEYS',
        name,
        signature: result.signature,
        activatedBy: params.adminUserId,
        activatedAt: nowIso(),
      },
      { id: `collection_meta_${collectionMint.slice(0, 12)}_${Date.now()}` },
    )
  }

  return {
    ...result,
    collectionMint,
    uri,
  }
}

export async function adminActivateTemplateAsset(params: {
  adminUserId: string
  slug: NftGateSlug
  priceRing?: number
  /** When false, skip ImageConductor (use imageUri or placeholder). */
  regenerateArt?: boolean
  /** Pre-selected art URL from admin preview modal. */
  imageUri?: string
}): Promise<{
  success: boolean
  activeTemplateAsset?: string
  imageUri?: string
  error?: string
}> {
  if (!isNftGatesEnabled()) {
    return { success: false, error: 'NFT gates disabled in ring-config' }
  }

  const template = getNftGateTemplate(params.slug)
  if (!template) return { success: false, error: 'Unknown gate template' }

  const ensured = await WalletConductor.ensureNativeWallet({
    id: params.adminUserId,
    role: UserRolesArray.admin,
  })
  const wallet = ensured.native
  if (!ensured.ok || !wallet?.address) {
    return { success: false, error: ensured.error || 'Admin custodial Solana wallet required' }
  }

  let imageUri = `https://ring-platform.org/nft/gates/${params.slug}.png`
  if (params.imageUri?.trim()) {
    imageUri = params.imageUri.trim()
  } else if (params.regenerateArt !== false) {
    try {
      const {
        interpolateGateArtPrompt,
        buildGateArtPromptWithFaviconHint,
        loadProjectFaviconPngDataUri,
      } = await import('./art-prompt')
      const faviconDataUri = await loadProjectFaviconPngDataUri()
      const prompt = buildGateArtPromptWithFaviconHint(
        interpolateGateArtPrompt(template.imagePrompt),
        Boolean(faviconDataUri),
      )
      const art = await ImageConductor.generate({
        purpose: `nft-gate-${params.slug}`,
        prompt,
        actorId: params.adminUserId,
        ...(faviconDataUri
          ? { referenceImages: [{ url: faviconDataUri }] }
          : {}),
      })
      if (art.success && art.images?.[0]?.url) {
        imageUri = art.images[0].url
      }
    } catch (artError) {
      logger.warn('Admin mint: ImageConductor failed', { artError, slug: params.slug })
    }
  }

  const minted = await mintGateAsset({
    template: {
      ...template,
      priceRing: params.priceRing ?? template.priceRing,
    },
    ownerPubkey: wallet.address,
    metadataUri: imageUri,
    mintAuthorityLabel: 'admin',
  })
  if (!minted.success || !minted.asset) {
    return { success: false, error: minted.error || 'Mint failed' }
  }

  const editionId = `gate_edition_${params.slug}_${randomUUID().slice(0, 8)}`
  const priceRing = params.priceRing ?? template.priceRing
  await db().createDoc(
    'nft_gates',
    {
      id: editionId,
      kind: 'edition',
      slug: params.slug,
      activeTemplateAsset: minted.asset,
      priceRing,
      imageUri,
      soulbound: template.soulbound,
      collectionMint: getNftCollectionMint() || null,
      mintMode: minted.mode,
      signature: minted.signature,
      activatedBy: params.adminUserId,
      activatedAt: nowIso(),
    },
    { id: editionId },
  )

  const { upsertActiveTemplatePointer } = await import('./active-template-store')
  const pointer = await upsertActiveTemplatePointer({
    slug: params.slug,
    activeTemplateAsset: minted.asset,
    imageUri,
    priceRing,
    editionId,
    signature: minted.signature,
    activatedBy: params.adminUserId,
  })
  if (!pointer.success) {
    logger.warn('Admin mint: db() active template pointer writeback failed', {
      slug: params.slug,
      asset: minted.asset,
      error: pointer.error,
    })
  }

  logger.info('Admin activated gate template asset', {
    slug: params.slug,
    asset: minted.asset,
    mode: minted.mode,
    priceRing,
    pointerOk: pointer.success,
  })

  return {
    success: true,
    activeTemplateAsset: minted.asset,
    imageUri,
    ...(pointer.success
      ? {}
      : { error: `Minted, but DB active-template writeback failed: ${pointer.error}` }),
  }
}
