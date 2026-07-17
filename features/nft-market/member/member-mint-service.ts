import 'server-only'

import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import { isMemberCollectionsEnabled } from '@/features/nft-gates/config'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { hasMemberPrivileges, resolvePersistedUserRole } from '@/features/auth/user-role'
import type { NftOwnershipRecord } from '@/features/nft-gates/types'
import type { NftMemberCollection } from '@/features/nft-market/types'
import type { GenerativeGalleryValue } from '@/features/generative-media/types'
import {
  buildMetaplexMetadataJson,
  uploadNftMetadataJson,
} from '@/features/generative-media/nft-metadata'
import {
  getMemberCollectionById,
  incrementMemberCollectionMintCount,
} from './member-collection-service'

function nowIso() {
  return new Date().toISOString()
}

export async function listOwnedMemberMints(
  userId: string,
  collectionId?: string,
): Promise<NftOwnershipRecord[]> {
  const filters: Array<{ field: string; operator: '=='; value: string }> = [
    { field: 'userId', operator: '==', value: userId },
    { field: 'source', operator: '==', value: 'member_mint' },
  ]
  if (collectionId) {
    filters.push({ field: 'collectionId', operator: '==', value: collectionId })
  }
  const result = await db().queryDocs<NftOwnershipRecord>({
    collection: 'nft_ownership',
    filters,
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })
  if (!result.success || !result.data) return []
  return result.data.filter((row) => !row.burnedAt)
}

export async function mintMemberAsset(input: {
  creatorUserId: string
  collectionId: string
  name: string
  description?: string
  imageUri?: string
  metadataUri?: string
  gallery?: GenerativeGalleryValue
}): Promise<{ success: boolean; ownership?: NftOwnershipRecord; error?: string }> {
  if (!isMemberCollectionsEnabled()) {
    return { success: false, error: 'Member collections are disabled' }
  }

  const user = await db().readDoc<{ role?: string }>('users', input.creatorUserId)
  const role = resolvePersistedUserRole(user.success ? user.data?.role : undefined)
  if (!hasMemberPrivileges(role)) {
    return { success: false, error: 'Member privileges required to mint' }
  }

  const collection = await getMemberCollectionById(input.collectionId)
  if (!collection) return { success: false, error: 'Collection not found' }
  if (collection.creatorUserId !== input.creatorUserId) {
    return { success: false, error: 'Only the collection creator can mint' }
  }
  if (collection.status !== 'active') {
    return { success: false, error: 'Collection is not active' }
  }
  if ((collection.mintCount || 0) >= (collection.maxMints || 0)) {
    return { success: false, error: 'Collection mint cap reached' }
  }

  const name = input.name.trim().slice(0, 32)
  if (!name) return { success: false, error: 'Asset name is required' }

  const wallet = await getNativeWallet(input.creatorUserId, 'solana')
  if (!wallet?.address) {
    return { success: false, error: 'Custodial Solana wallet is required before minting' }
  }

  const imageUri = input.imageUri?.trim() || ''
  let metadataUri = input.metadataUri?.trim() || ''
  let showcase = undefined as NftOwnershipRecord['showcase']

  if (!metadataUri) {
    const built = buildMetaplexMetadataJson({
      name,
      symbol: collection.symbol,
      description: input.description,
      imageUri,
      gallery: input.gallery,
      collectionId: collection.id,
    })
    showcase = built.showcase
    const uploaded = await uploadNftMetadataJson(
      built.metadata,
      `nft/member/${collection.id}/${randomUUID().slice(0, 10)}.json`,
    )
    if (!uploaded.success || !uploaded.metadataUri) {
      return { success: false, error: uploaded.error || 'Failed to upload NFT metadata JSON' }
    }
    metadataUri = uploaded.metadataUri
  } else if (input.gallery || imageUri) {
    const built = buildMetaplexMetadataJson({
      name,
      symbol: collection.symbol,
      description: input.description,
      imageUri,
      gallery: input.gallery,
      collectionId: collection.id,
    })
    showcase = built.showcase
  }

  let asset = `member_${collection.id.slice(0, 12)}_${randomUUID().slice(0, 12)}`
  let signature: string | undefined
  let mode: NftMemberCollection['mode'] = 'ledger-dev'

  if (collection.mode === 'metaplex-core' && collection.collectionMint && !collection.collectionMint.startsWith('member_col_')) {
    const { mintMetaplexCoreOpenAsset } = await import(
      '@/features/nft-gates/metaplex-core-onchain'
    )
    const minted = await mintMetaplexCoreOpenAsset({
      collectionMint: collection.collectionMint,
      ownerPubkey: wallet.address,
      name,
      metadataUri,
      attributes: [
        { key: 'collectionId', value: collection.id },
        { key: 'symbol', value: collection.symbol },
        { key: 'showcase', value: 'v1' },
      ],
    })
    if (!minted.success || !minted.asset) {
      return { success: false, error: minted.error || 'On-chain mint failed' }
    }
    asset = minted.asset
    signature = minted.signature
    mode = 'metaplex-core'
  }

  const createdAt = nowIso()
  const ownershipId = `own_${input.creatorUserId}_${asset}`.slice(0, 255)
  const ownership: NftOwnershipRecord = {
    id: ownershipId,
    userId: input.creatorUserId,
    asset,
    slug: 'member-open',
    collectionMint: collection.collectionMint,
    collectionId: collection.id,
    source: 'member_mint',
    name,
    description: input.description?.trim() || undefined,
    metadataUri,
    soulbound: false,
    purchaseId: `member_mint_${randomUUID()}`,
    signature,
    priceRing: 0,
    imageUri: imageUri || undefined,
    showcase,
    createdAt,
  }

  const saved = await db().createDoc('nft_ownership', ownership, { id: ownershipId })
  if (!saved.success) {
    return { success: false, error: saved.error?.message || 'Failed to persist ownership' }
  }

  await incrementMemberCollectionMintCount(collection.id)
  void mode
  return { success: true, ownership }
}
