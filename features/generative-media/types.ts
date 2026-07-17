import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'
import { pickImageSrc, type MediaImageSlot } from '@/lib/file/media-asset'

/**
 * Generative Media SSOT types — gallery items shared across NFT + store product fields.
 */

export type GenerativeMediaScope = 'nft' | 'product'

export type GalleryItemSource = 'upload' | 'generated' | 'video'

export type GalleryItem = {
  id: string
  originalUrl: string
  /** Suggested-size WebP for list/first-paint; lightbox uses originalUrl */
  webpUrl?: string
  /** Full RingBase ladder when provider is ring_filebase. */
  derivatives?: MediaDerivatives
  contentType: string
  source: GalleryItemSource
  enabled: boolean
  isPrimary: boolean
  /** RingBase UUID (not storage objectKey). */
  fileId?: string
  messageId?: string
  createdAt?: string
}

export type GenerativeGalleryValue = {
  items: GalleryItem[]
}

export function pickGalleryDisplayUrl(
  item: GalleryItem | null | undefined,
  slot: MediaImageSlot = 'thumb',
): string {
  if (!item) return ''
  if (item.derivatives) {
    return pickImageSrc(
      { url: item.originalUrl, fileId: item.fileId, derivatives: item.derivatives },
      slot,
    )
  }
  return item.webpUrl || item.originalUrl
}

export type NftShowcaseExtras = {
  animationUrl?: string
  files?: Array<{ uri: string; type: string }>
  ringShowcase?: {
    primaryImageUrl: string
    media?: GalleryItem[]
    webglUrl?: string
    svgUrl?: string
    audioUrl?: string
  }
}

export const IMAGE_CONDUCTOR_SENDER_ID = 'system:image-conductor'
export const IMAGE_CONDUCTOR_SENDER_NAME = 'ImageConductor'
export const GHOST_WRITE_SENDER_ID = 'system:ghost-write'
export const GHOST_WRITE_SENDER_NAME = 'Ghost-write'

/** Stable tool-chat productId — hidden from Messages inbox. */
export function buildGenMediaChatKey(params: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
}): string {
  const scope = params.scope.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24) || 'nft'
  const page = params.pageSlug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'page'
  const field = params.fieldId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'field'
  const entity = (params.entityId || 'draft').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
  return `genmedia:${scope}:${entity}:${page}:${field}`
}

/** @deprecated Prefer buildGenMediaChatKey */
export function buildImageGenEditorChatKey(params: {
  pageSlug: string
  fieldId: string
}): string {
  return buildGenMediaChatKey({
    scope: 'nft',
    pageSlug: params.pageSlug,
    fieldId: params.fieldId,
  })
}

export function primaryGalleryUrl(gallery: GenerativeGalleryValue | GalleryItem[] | undefined): string {
  const items = Array.isArray(gallery) ? gallery : gallery?.items || []
  const primary = items.find((i) => i.isPrimary) || items[0]
  return primary?.originalUrl || ''
}

export function displayGalleryUrl(item: GalleryItem): string {
  return item.webpUrl || item.originalUrl
}

export function toProductImageUrls(gallery: GenerativeGalleryValue): string[] {
  const enabled = gallery.items.filter((i) => i.enabled)
  const primary = enabled.find((i) => i.isPrimary)
  const rest = enabled.filter((i) => i.id !== primary?.id)
  const ordered = primary ? [primary, ...rest] : enabled
  return ordered.map((i) => i.originalUrl)
}

export function galleryFromUrlList(urls: string[]): GenerativeGalleryValue {
  return {
    items: urls.filter(Boolean).map((url, index) => ({
      id: `legacy_${index}_${url.slice(-12)}`,
      originalUrl: url,
      contentType: 'image/jpeg',
      source: 'upload' as const,
      enabled: true,
      isPrimary: index === 0,
    })),
  }
}
