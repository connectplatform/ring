import { auth } from '@/auth'
import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import { getNativeTokenAddress, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import {
  getMarketplaceFeeBps,
  getMarketplaceFeeRecipient,
  getNftCollectionMint,
  getNftCollectionSymbol,
  getNftCollectionUri,
  getNftGateTemplateResolved,
} from '@/features/nft-gates/config'
import type { NftGateSlug } from '@/features/nft-gates/types'
import type {
  CreateNftListingDraftInput,
  NftMarketListing,
  NftMarketListingFilters,
  NftMarketSale,
} from '@/features/nft-market/types'
import { assertGateCanBeListed } from '@/features/nft-market/listing-policy'
import { assertMemberAssetCanBeListed } from '@/features/nft-market/member/member-listing-policy'
import { getMemberCollectionById } from '@/features/nft-market/member/member-collection-service'
import { getNftMarketListings } from './listing-query'
import { SolanaMarketClient, splitMarketplaceFee } from './solana-market-client'
import type { NftMarketLane } from '@/features/nft-market/types'

type ServiceResult<T = { id: string }> = {
  success: boolean
  data?: T
  id?: string
  error?: string
}

function nowIso() {
  return new Date().toISOString()
}

function toLegacyDraftInput(data: any, sellerUserId: string): CreateNftListingDraftInput {
  return {
    sellerUserId: data.sellerUserId ?? sellerUserId,
    sellerUsername: data.sellerUsername,
    asset: data.asset ?? data.item?.asset ?? data.item?.address ?? '',
    slug: data.slug ?? data.item?.slug,
    priceRing: data.priceRing ?? data.price?.amount ?? data.amount ?? '',
    lane: data.lane === 'member' ? 'member' : 'keys',
    collectionId: data.collectionId,
    name: data.name,
    description: data.description,
    metadataUri: data.metadataUri,
    imageUri: data.imageUri,
    attributes: data.attributes,
    licenseExpiresAt: data.licenseExpiresAt,
  }
}

async function getSessionUserId(explicitUserId?: string) {
  if (explicitUserId) return explicitUserId
  const session = await auth()
  return session?.user?.id ?? null
}

async function resolveSellerUsername(userId: string, fallback?: string) {
  if (fallback?.trim()) return fallback.trim().replace(/^@/, '')
  const user = await db().readDoc<{ username?: string; ringUsername?: string; name?: string }>('users', userId)
  return user.success
    ? user.data?.username ?? user.data?.ringUsername ?? user.data?.name ?? undefined
    : undefined
}

async function refreshCollectionCache(listing: NftMarketListing) {
  const id = listing.collection || getNftCollectionSymbol()
  const active = await db().queryDocs<NftMarketListing>({
    collection: 'nft_listings',
    filters: [
      { field: 'chainFamily', operator: '==', value: 'solana' },
      { field: 'status', operator: '==', value: 'active' },
      { field: 'collection', operator: '==', value: listing.collection ?? '' },
    ],
    pagination: { limit: 500 },
  })
  const items = active.success ? active.data ?? [] : []
  const rawPrices = items.map((item) => BigInt(item.priceRaw)).sort((a, b) => (a < b ? -1 : 1))
  const volume = items.reduce((sum, item) => sum + BigInt(item.priceRaw), 0n)
  const payload = {
    id,
    collection: listing.collection ?? id,
    slug: listing.slug,
    name: listing.collectionName ?? 'Ringdom Keys Collection',
    symbol: listing.collectionSymbol || getNftCollectionSymbol(),
    uri: listing.collectionUri || getNftCollectionUri(),
    imageUri: listing.imageUri,
    activeListings: items.length,
    floorPriceRaw: rawPrices[0]?.toString(),
    volumeRaw: volume.toString(),
    itemCount: items.length,
    creatorUserId: listing.lane === 'member' ? listing.sellerUserId : undefined,
    lane: listing.lane || 'keys',
    updatedAt: nowIso(),
  }
  const existing = await db().readDoc('nft_market_collections', id)
  if (existing.success && existing.data) {
    await db().updateDoc('nft_market_collections', id, payload)
  } else {
    await db().createDoc('nft_market_collections', payload, { id })
  }
}

export async function createListingDraft(data: any): Promise<ServiceResult<NftMarketListing>> {
  try {
    const sellerUserId = await getSessionUserId(data.sellerUserId)
    if (!sellerUserId) return { success: false, error: 'Authentication required' }

    const input = toLegacyDraftInput(data, sellerUserId)
    if (!input.asset || !input.slug || input.priceRing === '') {
      return { success: false, error: 'asset, slug and priceRing are required' }
    }

    const lane: NftMarketLane = input.lane === 'member' ? 'member' : 'keys'
    const sellerWallet = await getNativeWallet(sellerUserId, 'solana')
    if (!sellerWallet?.address) {
      return { success: false, error: 'Seller custodial Solana wallet is required' }
    }

    const decimals = getNativeTokenDecimals('solana')
    const priceRaw = nativeTokenUiToRaw(String(input.priceRing), decimals).toString()
    const feeBps = getMarketplaceFeeBps()
    const { feeRaw, sellerProceedsRaw } = splitMarketplaceFee(priceRaw, feeBps)
    const createdAt = nowIso()
    const sellerUsername = await resolveSellerUsername(sellerUserId, input.sellerUsername)

    let listing: NftMarketListing

    if (lane === 'member') {
      if (!input.collectionId) {
        return { success: false, error: 'collectionId is required for member listings' }
      }
      const policy = await assertMemberAssetCanBeListed({
        userId: sellerUserId,
        asset: input.asset,
        collectionId: input.collectionId,
      })
      if (!policy.ok) return { success: false, error: policy.error }

      const collection = await getMemberCollectionById(input.collectionId)
      if (!collection) return { success: false, error: 'Member collection not found' }

      const name = input.name || policy.ownership?.name || collection.name
      const description = input.description || policy.ownership?.description || collection.description
      listing = {
        id: `nft_listing_${randomUUID()}`,
        chainFamily: 'solana',
        mode: collection.mode,
        lane: 'member',
        asset: input.asset,
        collection: collection.collectionMint,
        collectionId: collection.id,
        collectionName: collection.name,
        collectionSymbol: collection.symbol,
        collectionUri: collection.uri,
        slug: input.slug || 'member-open',
        name,
        description,
        imageUri: input.imageUri ?? policy.ownership?.imageUri ?? collection.imageUri,
        metadataUri: input.metadataUri ?? policy.ownership?.metadataUri,
        showcase: policy.ownership?.showcase,
        attributes: input.attributes,
        sellerUserId,
        sellerUsername,
        sellerWallet: sellerWallet.address,
        ownershipId: policy.ownership?.id,
        priceRaw,
        priceRing: String(input.priceRing),
        decimals,
        currency: 'RING',
        ringMint: getNativeTokenAddress(),
        feeBps,
        feeRecipient: getMarketplaceFeeRecipient(),
        feeRaw,
        sellerProceedsRaw,
        licenseExpiresAt: input.licenseExpiresAt,
        createdAt,
        updatedAt: createdAt,
        status: 'draft',
        searchText: [name, description, collection.symbol, collection.name, input.asset]
          .filter(Boolean)
          .join(' '),
      }
    } else {
      const policy = await assertGateCanBeListed({
        userId: sellerUserId,
        asset: input.asset,
        slug: String(input.slug),
      })
      if (!policy.ok) return { success: false, error: policy.error }

      const template = await getNftGateTemplateResolved(input.slug)
      if (!template) return { success: false, error: 'Unknown gate template' }

      listing = {
        id: `nft_listing_${randomUUID()}`,
        chainFamily: 'solana',
        mode: 'ledger-dev',
        lane: 'keys',
        asset: input.asset,
        collection: getNftCollectionMint(),
        collectionName: 'Ringdom Keys Collection',
        collectionSymbol: getNftCollectionSymbol(),
        collectionUri: getNftCollectionUri(),
        slug: input.slug,
        name: template.name,
        description: template.description,
        imageUri: input.imageUri ?? policy.ownership?.imageUri,
        metadataUri: input.metadataUri,
        attributes: input.attributes,
        sellerUserId,
        sellerUsername,
        sellerWallet: sellerWallet.address,
        ownershipId: policy.ownership?.id,
        priceRaw,
        priceRing: String(input.priceRing),
        decimals,
        currency: 'RING',
        ringMint: getNativeTokenAddress(),
        feeBps,
        feeRecipient: getMarketplaceFeeRecipient(),
        feeRaw,
        sellerProceedsRaw,
        licenseExpiresAt: input.licenseExpiresAt,
        createdAt,
        updatedAt: createdAt,
        status: 'draft',
        searchText: [
          template.name,
          template.description,
          input.slug,
          getNftCollectionSymbol(),
          input.asset,
        ]
          .filter(Boolean)
          .join(' '),
      }
    }

    const created = await db().createDoc<NftMarketListing>('nft_listings', listing, { id: listing.id })
    if (!created.success || !created.data) {
      return { success: false, error: created.error?.message || 'Failed to create listing draft' }
    }
    return { success: true, id: listing.id, data: created.data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create listing draft' }
  }
}

export async function activateListing(
  input: string | { listingId: string; sellerUserId?: string },
  _legacyTxHash?: string,
): Promise<ServiceResult<NftMarketListing>> {
  try {
    const listingId = typeof input === 'string' ? input : input.listingId
    const sellerUserId = await getSessionUserId(typeof input === 'string' ? undefined : input.sellerUserId)
    if (!sellerUserId) return { success: false, error: 'Authentication required' }

    const listingResult = await db().readDoc<NftMarketListing>('nft_listings', listingId)
    const listing = listingResult.success ? listingResult.data : null
    if (!listing) return { success: false, error: 'Listing not found' }
    if (listing.sellerUserId !== sellerUserId) {
      return { success: false, error: 'Not authorized to activate this listing' }
    }
    if (listing.status !== 'draft') {
      return { success: false, error: 'Only draft listings can be activated' }
    }

    const policy =
      listing.lane === 'member' && listing.collectionId
        ? await assertMemberAssetCanBeListed({
            userId: sellerUserId,
            asset: listing.asset,
            collectionId: listing.collectionId,
          })
        : await assertGateCanBeListed({
            userId: sellerUserId,
            asset: listing.asset,
            slug: String(listing.slug),
          })
    if (!policy.ok) return { success: false, error: policy.error }

    const market = await SolanaMarketClient.listGate({
      asset: listing.asset,
      sellerWallet: listing.sellerWallet,
    })
    const listedAt = nowIso()
    const updated = await db().updateDoc<NftMarketListing>('nft_listings', listingId, {
      mode: market.mode,
      listingPda: market.listingPda,
      listSignature: market.signature,
      status: 'active',
      listedAt,
      updatedAt: listedAt,
    })
    if (!updated.success || !updated.data) {
      return { success: false, error: updated.error?.message || 'Failed to activate listing' }
    }
    await refreshCollectionCache(updated.data)
    return { success: true, id: listingId, data: updated.data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to activate listing' }
  }
}

export async function cancelListing(input: {
  listingId: string
  sellerUserId?: string
}): Promise<ServiceResult<NftMarketListing>> {
  try {
    const sellerUserId = await getSessionUserId(input.sellerUserId)
    if (!sellerUserId) return { success: false, error: 'Authentication required' }

    const listing = await getListingById(input.listingId)
    if (!listing.success || !listing.data) return { success: false, error: 'Listing not found' }
    if (listing.data.status !== 'active' && listing.data.status !== 'draft') {
      return { success: false, error: 'Only draft or active listings can be cancelled' }
    }
    const market = await SolanaMarketClient.cancelGate({ listing: listing.data, sellerUserId })
    const cancelledAt = nowIso()
    const updated = await db().updateDoc<NftMarketListing>('nft_listings', input.listingId, {
      status: 'cancelled',
      cancelSignature: market.signature,
      cancelledAt,
      updatedAt: cancelledAt,
    })
    if (!updated.success || !updated.data) {
      return { success: false, error: updated.error?.message || 'Failed to cancel listing' }
    }
    await refreshCollectionCache(updated.data)
    return { success: true, id: input.listingId, data: updated.data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel listing' }
  }
}

export async function getListingById(listingId: string): Promise<ServiceResult<NftMarketListing>> {
  const result = await db().readDoc<NftMarketListing>('nft_listings', listingId)
  if (!result.success) return { success: false, error: result.error?.message || 'Failed to read listing' }
  if (!result.data || result.data.chainFamily !== 'solana') {
    return { success: false, error: 'Listing not found' }
  }
  return { success: true, id: listingId, data: result.data }
}

export async function markSold(input: {
  listingId: string
  buyerUserId: string
  buyerWallet?: string
  sale: NftMarketSale
  signature: string
}): Promise<ServiceResult<NftMarketListing>> {
  const soldAt = nowIso()
  const result = await db().transaction(async (tx) => {
    const listingDoc = await tx.read<NftMarketListing>('nft_listings', input.listingId)
    if (!listingDoc?.data || listingDoc.data.status !== 'active') {
      throw new Error('Listing is no longer active')
    }

    await tx.update<NftMarketListing>('nft_listings', input.listingId, {
      status: 'sold',
      buyerUserId: input.buyerUserId,
      buyerWallet: input.buyerWallet,
      saleSignature: input.signature,
      soldAt,
      updatedAt: soldAt,
    })

    if (listingDoc.data.ownershipId) {
      await tx.update('nft_ownership', listingDoc.data.ownershipId, {
        userId: input.buyerUserId,
        previousOwnerUserId: listingDoc.data.sellerUserId,
        purchaseId: input.sale.id,
        signature: input.signature,
        priceRing: Number(listingDoc.data.priceRing),
        transferredAt: soldAt,
        updatedAt: soldAt,
      })
    } else {
      const ownershipId = `own_${input.buyerUserId}_${listingDoc.data.asset}`.slice(0, 255)
      await tx.create(
        'nft_ownership',
        {
          id: ownershipId,
          userId: input.buyerUserId,
          asset: listingDoc.data.asset,
          slug: listingDoc.data.slug,
          collectionMint: listingDoc.data.collection,
          soulbound: false,
          purchaseId: input.sale.id,
          signature: input.signature,
          priceRing: Number(listingDoc.data.priceRing),
          imageUri: listingDoc.data.imageUri,
          createdAt: soldAt,
        },
        { id: ownershipId },
      )
    }

    return {
      ...listingDoc.data,
      status: 'sold' as const,
      buyerUserId: input.buyerUserId,
      buyerWallet: input.buyerWallet,
      saleSignature: input.signature,
      soldAt,
      updatedAt: soldAt,
    }
  })
  await refreshCollectionCache(result)
  return { success: true, id: input.listingId, data: result }
}

export async function getListings(filters: NftMarketListingFilters = {}) {
  const result = await getNftMarketListings(filters)
  return { success: true, data: result.items, ...result }
}

export async function getUserActiveListings(username: string, limit = 12) {
  return getListings({ sellerUsername: username, status: 'active', limit })
}
