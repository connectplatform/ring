import 'server-only'

import { randomUUID } from 'crypto'
import { db } from '@/lib/database'
import { isMemberCollectionsEnabled, getMaxCollectionsPerMember, getMaxMintsPerCollection, getNftCollectionMint } from '@/features/nft-gates/config'
import { hasMemberPrivileges, resolvePersistedUserRole } from '@/features/auth/user-role'
import type { NftMemberCollection } from '@/features/nft-market/types'

function nowIso() {
  return new Date().toISOString()
}

function slugifySymbol(input: string) {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
  return cleaned || 'RING'
}

export async function listMemberCollectionsForUser(
  creatorUserId: string,
): Promise<NftMemberCollection[]> {
  const result = await db().queryDocs<NftMemberCollection>({
    collection: 'nft_member_collections',
    filters: [{ field: 'creatorUserId', operator: '==', value: creatorUserId }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    pagination: { limit: 100 },
  })
  return result.success ? result.data ?? [] : []
}

export async function getMemberCollectionById(
  collectionId: string,
): Promise<NftMemberCollection | null> {
  const result = await db().readDoc<NftMemberCollection>('nft_member_collections', collectionId)
  return result.success ? result.data ?? null : null
}

export async function listActiveMemberCollections(
  limit = 48,
): Promise<NftMemberCollection[]> {
  const result = await db().queryDocs<NftMemberCollection>({
    collection: 'nft_member_collections',
    filters: [{ field: 'status', operator: '==', value: 'active' }],
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    pagination: { limit: Math.max(1, Math.min(100, limit)) },
  })
  return result.success ? result.data ?? [] : []
}

export async function createMemberCollection(input: {
  creatorUserId: string
  name: string
  symbol?: string
  description?: string
  imageUri?: string
  metadataUri?: string
}): Promise<{ success: boolean; data?: NftMemberCollection; error?: string }> {
  if (!isMemberCollectionsEnabled()) {
    return { success: false, error: 'Member collections are disabled' }
  }

  const user = await db().readDoc<{ role?: string }>('users', input.creatorUserId)
  const role = resolvePersistedUserRole(user.success ? user.data?.role : undefined)
  if (!hasMemberPrivileges(role)) {
    return { success: false, error: 'Member privileges required to create collections' }
  }

  const name = input.name.trim().slice(0, 32)
  if (!name) return { success: false, error: 'Collection name is required' }

  const existing = await listMemberCollectionsForUser(input.creatorUserId)
  const activeCount = existing.filter((c) => c.status !== 'archived').length
  if (activeCount >= getMaxCollectionsPerMember()) {
    return {
      success: false,
      error: `Collection limit reached (${getMaxCollectionsPerMember()} per member)`,
    }
  }

  const symbol = slugifySymbol(input.symbol || name)
  const createdAt = nowIso()
  const id = `mcol_${randomUUID()}`
  const maxMints = getMaxMintsPerCollection()

  // Prefer on-chain Core collection when platform KEYS collectionMint proves RPC works;
  // otherwise ledger-dev synthetic mint id for local PoC without sponsor gas.
  let mode: NftMemberCollection['mode'] = 'ledger-dev'
  let collectionMint = `member_col_${id.slice(0, 24)}`
  let createSignature: string | undefined

  const platformCollection = getNftCollectionMint()
  if (platformCollection) {
    try {
      const { createMetaplexCoreCollection } = await import(
        '@/features/nft-gates/metaplex-core-onchain'
      )
      const uri =
        input.metadataUri?.trim() ||
        input.imageUri?.trim() ||
        `https://ring-platform.org/nft/member/${id}.json`
      const created = await createMetaplexCoreCollection({ name, uri })
      if (created.success && created.collectionMint) {
        mode = 'metaplex-core'
        collectionMint = created.collectionMint
        createSignature = created.signature
      } else {
        // Fall back to ledger-dev rather than failing the whole PoC create flow.
        createSignature = created.error
      }
    } catch {
      // ledger-dev fallback
    }
  }

  const row: NftMemberCollection = {
    id,
    creatorUserId: input.creatorUserId,
    collectionMint,
    name,
    symbol,
    uri: input.metadataUri,
    imageUri: input.imageUri,
    description: input.description?.trim() || undefined,
    status: 'active',
    mintCount: 0,
    maxMints,
    mode,
    createSignature,
    createdAt,
    updatedAt: createdAt,
  }

  const saved = await db().createDoc('nft_member_collections', row, { id })
  if (!saved.success) {
    return { success: false, error: saved.error?.message || 'Failed to create collection' }
  }
  return { success: true, data: row }
}

export async function incrementMemberCollectionMintCount(
  collectionId: string,
): Promise<NftMemberCollection | null> {
  const current = await getMemberCollectionById(collectionId)
  if (!current) return null
  const mintCount = (current.mintCount || 0) + 1
  const updatedAt = nowIso()
  await db().updateDoc('nft_member_collections', collectionId, { mintCount, updatedAt })
  return { ...current, mintCount, updatedAt }
}
