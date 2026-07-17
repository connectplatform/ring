import 'server-only'

import { randomUUID } from 'crypto'
import { file } from '@/lib/file'
import type { GalleryItem, GenerativeGalleryValue, NftShowcaseExtras } from '@/features/generative-media/types'
import { primaryGalleryUrl } from '@/features/generative-media/types'

export type MetaplexOffchainMetadata = {
  name: string
  symbol?: string
  description?: string
  image: string
  animation_url?: string
  attributes?: Array<{ trait_type: string; value: string }>
  properties?: {
    files?: Array<{ uri: string; type: string }>
    category?: string
  }
}

export function buildNftShowcaseExtras(
  gallery: GenerativeGalleryValue | undefined,
  primaryImageUrl: string,
): NftShowcaseExtras {
  const items = gallery?.items?.filter((i) => i.enabled) || []
  const video = items.find(
    (i) => i.source === 'video' || i.contentType.startsWith('video/'),
  )
  const files = items.map((i) => ({
    uri: i.originalUrl,
    type: i.contentType || 'image/jpeg',
  }))

  return {
    animationUrl: video?.originalUrl,
    files,
    ringShowcase: {
      primaryImageUrl,
      media: items,
    },
  }
}

export function buildMetaplexMetadataJson(params: {
  name: string
  symbol?: string
  description?: string
  imageUri: string
  gallery?: GenerativeGalleryValue
  collectionId?: string
}): { metadata: MetaplexOffchainMetadata; showcase: NftShowcaseExtras } {
  const primary =
    params.imageUri.trim() ||
    primaryGalleryUrl(params.gallery) ||
    ''
  const showcase = buildNftShowcaseExtras(params.gallery, primary)
  const files =
    showcase.files && showcase.files.length > 0
      ? showcase.files
      : primary
        ? [{ uri: primary, type: 'image/jpeg' }]
        : []

  const metadata: MetaplexOffchainMetadata = {
    name: params.name.slice(0, 32),
    symbol: params.symbol?.slice(0, 10),
    description: params.description?.slice(0, 500),
    image: primary,
    ...(showcase.animationUrl ? { animation_url: showcase.animationUrl } : {}),
    attributes: [
      { trait_type: 'showcase', value: 'v1' },
      ...(params.collectionId
        ? [{ trait_type: 'collectionId', value: params.collectionId.slice(0, 64) }]
        : []),
    ],
    properties: {
      category: showcase.animationUrl ? 'video' : 'image',
      files,
    },
  }

  return { metadata, showcase }
}

/** Upload off-chain Metaplex JSON; returns public metadata URI. */
export async function uploadNftMetadataJson(
  metadata: MetaplexOffchainMetadata,
  objectKeyHint?: string,
): Promise<{ success: boolean; metadataUri?: string; error?: string }> {
  const key =
    objectKeyHint ||
    `nft/metadata/${Date.now()}-${randomUUID().slice(0, 8)}.json`
  const body = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8')
  const upload = await file().upload(key, body, {
    access: 'public',
    contentType: 'application/json',
    metadata: { purpose: 'nft-metadata' },
  })
  if (!upload.success || !upload.url) {
    return { success: false, error: upload.error || 'Metadata upload failed' }
  }
  return { success: true, metadataUri: upload.url }
}

export function parseGalleryFromForm(
  formData: FormData,
  fieldName = 'imageUriGallery',
): GenerativeGalleryValue | undefined {
  const raw = String(formData.get(fieldName) || '')
  if (!raw.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as GenerativeGalleryValue | GalleryItem[]
    if (Array.isArray(parsed)) return { items: parsed }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) return parsed
  } catch {
    return undefined
  }
  return undefined
}
