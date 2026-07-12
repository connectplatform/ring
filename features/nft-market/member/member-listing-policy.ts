import 'server-only'

import { db } from '@/lib/database'
import { isMemberCollectionsEnabled } from '@/features/nft-gates/config'
import { hasMemberPrivileges, resolvePersistedUserRole } from '@/features/auth/user-role'
import type { NftOwnershipRecord } from '@/features/nft-gates/types'
import { findActiveListingByAsset } from '@/features/nft-market/listing-policy'
import { getMemberCollectionById } from './member-collection-service'

export async function assertMemberAssetCanBeListed(params: {
  userId: string
  asset: string
  collectionId: string
  userRole?: string | null
}): Promise<{
  ok: boolean
  error?: string
  ownership?: NftOwnershipRecord
}> {
  if (!isMemberCollectionsEnabled()) {
    return { ok: false, error: 'Member collections are disabled' }
  }

  let roleInput: unknown = params.userRole
  if (roleInput == null) {
    const user = await db().readDoc<{ role?: string }>('users', params.userId)
    roleInput = user.success ? user.data?.role : undefined
  }
  const role = resolvePersistedUserRole(roleInput)
  if (!hasMemberPrivileges(role)) {
    return { ok: false, error: 'Member privileges required to list creator NFTs' }
  }

  const collection = await getMemberCollectionById(params.collectionId)
  if (!collection || collection.status !== 'active') {
    return { ok: false, error: 'Member collection not found or inactive' }
  }

  const owned = await db().queryDocs<NftOwnershipRecord>({
    collection: 'nft_ownership',
    filters: [
      { field: 'userId', operator: '==', value: params.userId },
      { field: 'asset', operator: '==', value: params.asset },
      { field: 'source', operator: '==', value: 'member_mint' },
    ],
    pagination: { limit: 1 },
  })
  const ownership = owned.success ? owned.data?.[0] : undefined
  if (!ownership || ownership.burnedAt) {
    return { ok: false, error: 'No active member ownership for this asset' }
  }
  if (ownership.soulbound) {
    return { ok: false, error: 'Soulbound assets cannot be listed' }
  }
  if (ownership.collectionId && ownership.collectionId !== params.collectionId) {
    return { ok: false, error: 'Asset does not belong to this collection' }
  }
  if (
    collection.collectionMint &&
    ownership.collectionMint &&
    ownership.collectionMint !== collection.collectionMint
  ) {
    return { ok: false, error: 'Ownership collection mint mismatch' }
  }

  const existingListing = await findActiveListingByAsset(params.asset)
  if (existingListing) {
    return { ok: false, error: 'Asset already has an active listing' }
  }

  return { ok: true, ownership }
}
