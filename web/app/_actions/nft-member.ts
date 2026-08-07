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
  const { parseGalleryFromForm } = await import('@/features/generative-media/nft-metadata')
  const gallery = parseGalleryFromForm(formData, 'imageUriGallery')
  const { mintMemberAsset } = await import('@/features/nft-market/member/member-mint-service')
  const result = await mintMemberAsset({
    creatorUserId: gate.session.user!.id!,
    collectionId,
    name: readString(formData, 'name'),
    description: readString(formData, 'description') || undefined,
    imageUri: readString(formData, 'imageUri') || undefined,
    metadataUri: readString(formData, 'metadataUri') || undefined,
    gallery,
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

/**
 * Member: ImageConductor turn with /messages history + optional background FCM/in-app notify.
 */
export async function runNftImageGenEditorAction(input: {
  prompt: string
  pageSlug: string
  fieldId: string
  purpose?: string
  /** When true (modal blurred / hidden), push notification on completion. */
  notifyIfBackground?: boolean
}): Promise<{
  success: boolean
  conversationId?: string
  images?: Array<{ url: string; recordId?: string }>
  error?: string
}> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const { runImageGenEditorTurn } = await import(
    '@/features/nft-market/member/image-gen-editor-service'
  )
  const result = await runImageGenEditorTurn({
    userId: gate.session.user!.id!,
    userName: gate.session.user!.name || gate.session.user!.username || 'Member',
    pageSlug: input.pageSlug || 'nft-create',
    fieldId: input.fieldId || 'imageUri',
    prompt: input.prompt,
    purpose: input.purpose,
    notifyIfBackground: Boolean(input.notifyIfBackground),
  })

  return {
    success: result.success,
    conversationId: result.conversationId,
    images: result.images,
    error: result.error,
  }
}

/** Load ImageConductor editor message history (messages backend). */
export async function listNftImageGenMessagesAction(input: {
  pageSlug: string
  fieldId: string
}): Promise<{
  success: boolean
  conversationId?: string
  messages?: Array<{
    id: string
    senderId: string
    senderName: string
    content: string
    type: string
    timestamp: string
    attachments?: Array<{ url: string; name: string; type: string }>
  }>
  error?: string
}> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const { listImageGenMessages } = await import(
    '@/features/nft-market/member/image-gen-editor-service'
  )
  const { conversationId, messages } = await listImageGenMessages({
    userId: gate.session.user!.id!,
    pageSlug: input.pageSlug || 'nft-create',
    fieldId: input.fieldId || 'imageUri',
  })

  return {
    success: true,
    conversationId,
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      content: m.content,
      type: m.type,
      timestamp:
        typeof m.timestamp === 'string'
          ? m.timestamp
          : m.timestamp instanceof Date
            ? m.timestamp.toISOString()
            : new Date().toISOString(),
      attachments: m.attachments?.map((a) => ({
        url: a.url,
        name: a.name,
        type: a.type,
      })),
    })),
  }
}

/** Delete an uploaded NFT media object via file() abstraction. */
export async function deleteNftMediaAction(input: {
  url: string
}): Promise<{ success: boolean; error?: string }> {
  const gate = await requireMember()
  if ('error' in gate) return { success: false, error: gate.error }

  const url = input.url?.trim()
  if (!url) return { success: false, error: 'URL required' }

  try {
    const { file } = await import('@/lib/file')
    const result = await file().delete(url)
    if (!result.success) {
      return { success: false, error: result.error || 'Delete failed' }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    }
  }
}

/** @deprecated Prefer runNftImageGenEditorAction (history + notify). */
export async function previewMemberNftArtAction(input: {
  prompt: string
  purpose?: string
  pageSlug?: string
  fieldId?: string
  notifyIfBackground?: boolean
}): Promise<{
  success: boolean
  images?: Array<{ url: string; recordId?: string }>
  error?: string
}> {
  return runNftImageGenEditorAction({
    prompt: input.prompt,
    purpose: input.purpose,
    pageSlug: input.pageSlug || 'nft-create',
    fieldId: input.fieldId || 'imageUri',
    notifyIfBackground: input.notifyIfBackground,
  })
}
