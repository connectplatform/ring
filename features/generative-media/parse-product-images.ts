/**
 * Parse generative gallery / product image URLs from FormData (SSOT for vendor + admin).
 * Prefers pre-uploaded URL lists from GenerativeMediaField over legacy File photo-* fields.
 */

import type { GenerativeGalleryValue, GalleryItem } from '@/features/generative-media/types'
import { toProductImageUrls } from '@/features/generative-media/types'

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
    const urls = toProductImageUrls(gallery).filter(isHttpUrl)
    if (urls.length > 0) {
      return { photoUrls: urls.slice(0, 5), gallery }
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
