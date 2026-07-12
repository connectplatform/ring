'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { hasMemberPrivileges, resolveSessionUserRole } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'

export type NftMemberActionState = {
  success?: boolean
  error?: string
  message?: string
  id?: string
  collectionId?: string
  ownershipId?: string
  listingId?: string
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function requireMember() {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Unauthorized' as const }
  const role = resolveSessionUserRole(session.user.role as string)
  if (!hasMemberPrivileges(role)) {
    return { error: 'Member privileges required' as const }
  }
  return { session }
}

export async function createMemberCollectionAction(
  _prev: NftMemberActionState | null,
  formData: FormData,
): Promise<NftMemberActionState> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const { createMemberCollection } = await import(
    '@/features/nft-market/member/member-collection-service'
  )
  const result = await createMemberCollection({
    creatorUserId: gate.session.user!.id!,
    name: readString(formData, 'name'),
    symbol: readString(formData, 'symbol') || undefined,
    description: readString(formData, 'description') || undefined,
    imageUri: readString(formData, 'imageUri') || undefined,
    metadataUri: readString(formData, 'metadataUri') || undefined,
  })
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Failed to create collection' }
  }

  revalidatePath(ROUTES.NFT_CREATE())
  revalidatePath(ROUTES.NFT_COLLECTIONS())
  return {
    success: true,
    id: result.data.id,
    collectionId: result.data.id,
    message: 'Collection created',
  }
}

export async function mintMemberAssetAction(
  _prev: NftMemberActionState | null,
  formData: FormData,
): Promise<NftMemberActionState> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const collectionId = readString(formData, 'collectionId')
  const { mintMemberAsset } = await import('@/features/nft-market/member/member-mint-service')
  const result = await mintMemberAsset({
    creatorUserId: gate.session.user!.id!,
    collectionId,
    name: readString(formData, 'name'),
    description: readString(formData, 'description') || undefined,
    imageUri: readString(formData, 'imageUri') || undefined,
    metadataUri: readString(formData, 'metadataUri') || undefined,
  })
  if (!result.success || !result.ownership) {
    return { success: false, error: result.error || 'Mint failed', collectionId }
  }

  revalidatePath(ROUTES.NFT_CREATE())
  revalidatePath(ROUTES.NFT_CREATE_COLLECTION(collectionId))
  return {
    success: true,
    collectionId,
    ownershipId: result.ownership.id,
    id: result.ownership.asset,
    message: 'Asset minted',
  }
}

export async function listMemberAssetAction(
  _prev: NftMemberActionState | null,
  formData: FormData,
): Promise<NftMemberActionState> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const collectionId = readString(formData, 'collectionId')
  const asset = readString(formData, 'asset')
  const priceRing = readString(formData, 'priceRing')
  if (!collectionId || !asset || !priceRing) {
    return { success: false, error: 'collectionId, asset and priceRing are required' }
  }

  const { createListingDraft, activateListing } = await import(
    '@/features/nft-market/services/listing-service'
  )
  const draft = await createListingDraft({
    sellerUserId: gate.session.user!.id!,
    sellerUsername: gate.session.user!.username || gate.session.user!.name,
    lane: 'member',
    collectionId,
    asset,
    slug: 'member-open',
    priceRing,
    name: readString(formData, 'name') || undefined,
    description: readString(formData, 'description') || undefined,
    imageUri: readString(formData, 'imageUri') || undefined,
    metadataUri: readString(formData, 'metadataUri') || undefined,
  })
  if (!draft.success || !draft.id) {
    return { success: false, error: draft.error || 'Failed to create listing draft', collectionId }
  }

  const activated = await activateListing({
    listingId: draft.id,
    sellerUserId: gate.session.user!.id!,
  })
  if (!activated.success) {
    return {
      success: false,
      error: activated.error || 'Failed to activate listing',
      collectionId,
      listingId: draft.id,
    }
  }

  revalidatePath(ROUTES.NFT_MARKET())
  revalidatePath(ROUTES.NFT_CREATE_COLLECTION(collectionId))
  revalidatePath(ROUTES.PROFILE())
  return {
    success: true,
    collectionId,
    listingId: activated.id,
    message: 'Listing activated',
  }
}
