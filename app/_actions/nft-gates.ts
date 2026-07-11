'use server'

/**
 * NFT Gate server actions — buy / stake / unstake / admin activate.
 * Mint SSOT: Metaplex Core. Stake SSOT: GateEscrow (not NATIVE_NFT_APR).
 */

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import {
  isPlatformAdmin,
  isSuperadmin,
  resolvePersistedUserRole,
  UserRolesArray,
} from '@/features/auth/user-role'
import { MEMBERSHIP_GATE_SLUGS, type NftGateSlug } from '@/features/nft-gates/types'
import {
  listNftGateTemplates,
  listNftGateTemplatesResolved,
  isNftGatesEnabled,
} from '@/features/nft-gates/config'
import { purchaseGateNft, listOwnedGateAssets } from '@/features/nft-gates/purchase'
import {
  listActiveStakes,
  stakeGateAsset,
  unstakeGateAsset,
} from '@/features/nft-gates/gate-escrow'
import { hasFeature, listUnlockedFeatures } from '@/features/nft-gates/gate-resolver'
import {
  adminActivateTemplateAsset,
  adminCreateGateCollection,
  adminUpdateGateCollectionMetadata,
} from '@/features/nft-gates/admin-mint'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { ROUTES } from '@/constants/routes'

export async function listGateTemplatesAction() {
  if (!isNftGatesEnabled()) {
    return { success: false as const, error: 'NFT gates disabled', templates: [] }
  }
  return { success: true as const, templates: await listNftGateTemplatesResolved() }
}

export async function getMyGateInventoryAction() {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  const [owned, stakes, features] = await Promise.all([
    listOwnedGateAssets(session.user.id),
    listActiveStakes(session.user.id),
    listUnlockedFeatures(session.user.id),
  ])
  return { success: true as const, owned, stakes, features }
}

export async function purchaseGateAction(slug: NftGateSlug) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  if (!isNftGatesEnabled()) {
    return { success: false as const, error: 'NFT gates disabled' }
  }

  // Membership SKUs go through SubscriptionConductor so ledger + MEMBER role stay SSOT
  if (MEMBERSHIP_GATE_SLUGS.includes(slug)) {
    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )
    const template = listNftGateTemplates().find((t) => t.slug === slug)
    const result = await SubscriptionConductor.createSubscription({
      userId: session.user.id,
      userEmail: session.user.email || '',
      provider: 'nft_gate',
      gateway: getNativeTokenSymbol(),
      method: 'nft',
      amount: template?.priceRing ?? 0,
      currency: getNativeTokenSymbol(),
      gatewayFeePercent: 0,
      gatewayFeeFixed: 0,
      metadata: {
        gateSlug: slug,
        userRole: session.user.role,
      },
    })
    if (result.success) {
      revalidatePath(ROUTES.NFT_GATES())
      revalidatePath(ROUTES.VENDOR_DASHBOARD())
    }
    return result
  }

  const result = await purchaseGateNft({
    userId: session.user.id,
    slug,
    autoStakeMembership: false,
    userRole: resolvePersistedUserRole(
      (session.user.role as UserRolesArray) || UserRolesArray.subscriber,
    ),
  })
  if (result.success) {
    revalidatePath(ROUTES.NFT_GATES())
    revalidatePath(ROUTES.VENDOR_DASHBOARD())
  }
  return result
}

export async function stakeGateAction(asset: string, slug: NftGateSlug) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  const result = await stakeGateAsset({
    userId: session.user.id,
    asset,
    slug,
  })
  if (result.success) {
    revalidatePath(ROUTES.NFT_GATES())
    revalidatePath(ROUTES.VENDOR_DASHBOARD())
  }
  return result
}

export async function unstakeGateAction(asset: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  const result = await unstakeGateAsset({
    userId: session.user.id,
    asset,
  })
  if (result.success) {
    revalidatePath(ROUTES.NFT_GATES())
    revalidatePath(ROUTES.VENDOR_DASHBOARD())
  }
  return result
}

export async function hasGateFeatureAction(feature: Parameters<typeof hasFeature>[1]) {
  const session = await auth()
  if (!session?.user?.id) return false
  return hasFeature(session.user.id, feature)
}

export async function adminActivateGateTemplateAction(input: {
  slug: NftGateSlug
  priceRing?: number
  regenerateArt?: boolean
  imageUri?: string
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  if (!isPlatformAdmin(session.user.role) && !isSuperadmin(session.user.role)) {
    return { success: false as const, error: 'Admin required' }
  }

  const result = await adminActivateTemplateAsset({
    adminUserId: session.user.id,
    slug: input.slug,
    priceRing: input.priceRing,
    regenerateArt: input.regenerateArt,
    imageUri: input.imageUri,
  })
  if (result.success) {
    revalidatePath(ROUTES.ADMIN_NFT_TEMPLATES())
    revalidatePath(ROUTES.ADMIN_NFT_MINT())
  }
  return result
}

/** Admin: generate up to 4 ImageConductor previews for gate art selection (not minted). */
export async function previewGateArtAction(input: {
  slug: NftGateSlug
  prompt: string
}): Promise<{
  success: boolean
  images?: Array<{ url: string; recordId?: string }>
  error?: string
}> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }
  if (!isPlatformAdmin(session.user.role) && !isSuperadmin(session.user.role)) {
    return { success: false, error: 'Admin required' }
  }

  const promptRaw = input.prompt?.trim()
  if (!promptRaw) {
    return { success: false, error: 'Prompt is required' }
  }

  const template = listNftGateTemplates().find((t) => t.slug === input.slug)
  if (!template) {
    return { success: false, error: 'Unknown gate template' }
  }

  const {
    interpolateGateArtPrompt,
    buildGateArtPromptWithFaviconHint,
    loadProjectFaviconPngDataUri,
  } = await import('@/features/nft-gates/art-prompt')

  const faviconDataUri = await loadProjectFaviconPngDataUri()
  const prompt = buildGateArtPromptWithFaviconHint(
    interpolateGateArtPrompt(promptRaw),
    Boolean(faviconDataUri),
  )

  const { ImageConductor } = await import('@/lib/images/conductor/image-conductor')
  const art = await ImageConductor.generate({
    purpose: `nft-gate-preview-${input.slug}`,
    prompt,
    actorId: session.user.id,
    n: 4,
    ...(faviconDataUri ? { referenceImages: [{ url: faviconDataUri }] } : {}),
  })

  if (!art.success || !art.images?.length) {
    return { success: false, error: art.error || 'Preview generation failed' }
  }

  return {
    success: true,
    images: art.images.map((img) => ({ url: img.url, recordId: img.recordId })),
  }
}

export async function adminCreateGateCollectionAction(input?: {
  name?: string
  uri?: string
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  if (!isPlatformAdmin(session.user.role) && !isSuperadmin(session.user.role)) {
    return { success: false as const, error: 'Admin required' }
  }

  const result = await adminCreateGateCollection({
    adminUserId: session.user.id,
    name: input?.name,
    uri: input?.uri,
  })
  if (result.success) {
    revalidatePath(ROUTES.ADMIN_NFT_TEMPLATES())
    revalidatePath(ROUTES.ADMIN_NFT_MINT())
  }
  return result
}

/** Admin: updateCollection name+uri → KEYS metadata JSON (requires update authority). */
export async function adminUpdateGateCollectionMetadataAction(input?: {
  name?: string
  uri?: string
  collectionMint?: string
}) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false as const, error: 'Unauthorized' }
  }
  if (!isPlatformAdmin(session.user.role) && !isSuperadmin(session.user.role)) {
    return { success: false as const, error: 'Admin required' }
  }

  const result = await adminUpdateGateCollectionMetadata({
    adminUserId: session.user.id,
    name: input?.name,
    uri: input?.uri,
    collectionMint: input?.collectionMint,
  })
  if (result.success) {
    revalidatePath(ROUTES.ADMIN_NFT_TEMPLATES())
    revalidatePath(ROUTES.ADMIN_NFT_MINT())
  }
  return result
}
