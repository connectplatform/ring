'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import type { NftMarketListingFilters } from '@/features/nft-market/types'
import { ROUTES } from '@/constants/routes'

export type NftMarketActionState = {
  success?: boolean
  error?: string
  message?: string
  id?: string
  txHash?: string
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function listGateListingAction(
  _prevState: NftMarketActionState | null,
  formData: FormData,
): Promise<NftMarketActionState> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const { createListingDraft, activateListing } = await import(
    '@/features/nft-market/services/listing-service'
  )
  const draft = await createListingDraft({
    sellerUserId: session.user.id,
    sellerUsername: readString(formData, 'sellerUsername') || undefined,
    asset: readString(formData, 'asset'),
    slug: readString(formData, 'slug'),
    priceRing: readString(formData, 'priceRing'),
    metadataUri: readString(formData, 'metadataUri') || undefined,
    imageUri: readString(formData, 'imageUri') || undefined,
    licenseExpiresAt: readString(formData, 'licenseExpiresAt') || undefined,
  })
  if (!draft.success || !draft.id) {
    return { success: false, error: draft.error || 'Failed to create listing draft' }
  }

  const activated = await activateListing({ listingId: draft.id, sellerUserId: session.user.id })
  if (!activated.success) {
    return { success: false, id: draft.id, error: activated.error || 'Failed to activate listing' }
  }

  revalidatePath(ROUTES.NFT_MARKET())
  revalidatePath(ROUTES.NFT_MARKET_SELL())
  revalidatePath(ROUTES.PROFILE())
  return { success: true, id: activated.id, message: 'Listing activated' }
}

export async function cancelGateListingAction(
  _prevState: NftMarketActionState | null,
  formData: FormData,
): Promise<NftMarketActionState> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const listingId = readString(formData, 'listingId')
  if (!listingId) return { success: false, error: 'listingId is required' }

  const { cancelListing } = await import('@/features/nft-market/services/listing-service')
  const result = await cancelListing({ listingId, sellerUserId: session.user.id })
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to cancel listing' }
  }

  revalidatePath(ROUTES.NFT_MARKET())
  revalidatePath(ROUTES.NFT_MARKET_LISTING(listingId))
  revalidatePath(ROUTES.PROFILE())
  return { success: true, id: listingId, message: 'Listing cancelled' }
}

export async function purchaseGateListingAction(
  _prevState: NftMarketActionState | null,
  formData: FormData,
): Promise<NftMarketActionState> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

  const listingId = readString(formData, 'listingId')
  const idempotencyKey = readString(formData, 'idempotencyKey')
  if (!listingId || !idempotencyKey) {
    return { success: false, error: 'listingId and idempotencyKey are required' }
  }

  const { WalletConductor } = await import('@/features/wallet/conductor/wallet-conductor')
  const result = await WalletConductor.purchaseNftListing({
    buyerUserId: session.user.id,
    listingId,
    idempotencyKey,
  })
  if (!result.success) {
    return { success: false, error: result.error || 'Purchase failed' }
  }

  revalidatePath(ROUTES.NFT_MARKET())
  revalidatePath(ROUTES.NFT_MARKET_LISTING(listingId))
  revalidatePath(ROUTES.NFT_GATES())
  revalidatePath(ROUTES.PROFILE())
  return {
    success: true,
    id: listingId,
    txHash: result.txHash,
    message: result.message || 'NFT listing purchased',
  }
}

export async function getNftMarketListingsAction(filters: NftMarketListingFilters = {}) {
  const { getNftMarketListings } = await import('@/features/nft-market/services/listing-query')
  return getNftMarketListings(filters)
}
