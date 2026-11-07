/**
 * Parse generative gallery / product image URLs from FormData (SSOT for vendor + admin).
 * Prefers pre-uploaded URL lists from GenerativeMediaField over legacy File photo-* fields.
 */

import type { GenerativeGalleryValue, GalleryItem } from '@/features/generative-media/types'
import { galleryItemUrl, toProductImageUrls } from '@/features/generative-media/types'
import type { MediaDerivatives } from '@/lib/file/interfaces/IFileService'

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function parseGalleryJson(raw: string | null): GenerativeGalleryValue | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as GenerativeGalleryValue | GalleryItem[]
    if (Array.isArray(parsed)) {
      return { items: parsed }
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

function urlsFromCommaList(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter((u) => isHttpUrl(u))
}

/**
 * Resolve ordered original image URLs for store_products.images.
 * Also returns gallery payload for product.data.generativeGallery.
 */
export function resolveProductImagesFromForm(
  formData: FormData,
  existingUrls: string[] = [],
): {
  photoUrls: string[]
  gallery: GenerativeGalleryValue | null
} {
  const gallery =
    parseGalleryJson(String(formData.get('productImagesGallery') || '')) ||
    parseGalleryJson(String(formData.get('productImages') || ''))

  if (gallery?.items?.length) {
    const urls = toProductImageUrls(gallery).filter((url) => isHttpUrl(url) || url.startsWith('/'))
    if (urls.length > 0) {
      return { photoUrls: urls.slice(0, 5), gallery }
    }
    const fallback = gallery.items.map((item) => galleryItemUrl(item)).filter(Boolean)
    if (fallback.length > 0) {
      return { photoUrls: fallback.slice(0, 5), gallery }
    }
  }

  const fromList = urlsFromCommaList(String(formData.get('productImages') || ''))
  if (fromList.length > 0) {
    return { photoUrls: fromList.slice(0, 5), gallery: null }
  }

  // Legacy deletedPhotos + existing merge when no new gallery posted
  let photoUrls = [...existingUrls]
  const deletedPhotos = formData.get('deletedPhotos')
  if (typeof deletedPhotos === 'string' && deletedPhotos.trim()) {
    try {
      const deleted = JSON.parse(deletedPhotos) as string[]
      if (Array.isArray(deleted)) {
        photoUrls = photoUrls.filter((url) => !deleted.includes(url))
      }
    } catch {
      // ignore
    }
  }

  return { photoUrls, gallery: null }
}

export type ProductUploadDerivativeResult = {
  url: string
  fileId?: string
  contentType?: string
  derivatives?: MediaDerivatives
}

/** Gallery item for a RingBase product photo. originalUrl stays the original file. */
export function galleryItemFromProductUpload(
  result: ProductUploadDerivativeResult,
  opts?: { isPrimary?: boolean },
): GalleryItem {
  const derivatives = result.derivatives
  const webpUrl =
    derivatives?.card?.w640?.webp || derivatives?.thumb || derivatives?.mobile || undefined
  return {
    id: result.fileId || `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    originalUrl: result.url,
    ...(result.fileId ? { fileId: result.fileId } : {}),
    ...(webpUrl ? { webpUrl } : {}),
    ...(derivatives ? { derivatives } : {}),
    contentType: result.contentType || 'image/jpeg',
    source: 'upload',
    enabled: true,
    isPrimary: opts?.isPrimary ?? false,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Append RingBase uploads onto an existing gallery.
 * Legacy URL-only items stay so the card does not drop photos that have no ladder yet.
 */
export function mergeUploadedProductGallery(input: {
  existing?: GenerativeGalleryValue | null
  uploads: ProductUploadDerivativeResult[]
}): GenerativeGalleryValue {
  const existingItems = (input.existing?.items || []).filter((item) => item && item.originalUrl)
  const hasPrimary = existingItems.some((item) => item.isPrimary)
  const added = input.uploads
    .filter((upload) => upload.url)
    .map((upload, index) =>
      galleryItemFromProductUpload(upload, {
        isPrimary: !hasPrimary && existingItems.length === 0 && index === 0,
      }),
    )
  return { items: [...existingItems, ...added] }
}
