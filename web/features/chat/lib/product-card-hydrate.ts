import 'server-only'

import type { ProductCardMetadata } from '@/features/chat/types'
import type { StoreProduct } from '@/features/store/types'
import { ROUTES } from '@/constants/routes'
import { defaultLocale, type Locale } from '@/i18n/shared'
import { primaryGalleryUrl } from '@/features/generative-media/types'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'

function previewFromProduct(product: StoreProduct): string | undefined {
  const galleryUrl = primaryGalleryUrl(product.generativeGallery)
  if (galleryUrl) return galleryUrl
  const images = product.images
  if (Array.isArray(images) && typeof images[0] === 'string' && images[0]) {
    return images[0]
  }
  return undefined
}

/** Build CRM-hydrated product_card metadata (never trust LLM for price). */
export function buildProductCardMetadata(
  product: StoreProduct,
  locale: Locale = defaultLocale,
): ProductCardMetadata {
  return {
    kind: 'product_card',
    productId: String(product.id),
    title: String(product.name || 'Product'),
    url: ROUTES.STORE_PRODUCT(String(product.id), locale),
    description: product.description?.trim() || undefined,
    previewImage: previewFromProduct(product),
    price: String(product.price ?? ''),
    currency: String(product.currency || 'USD'),
    inStock: Boolean(product.inStock),
    vendorName: product.vendorName || undefined,
  }
}

export async function loadProductForCard(
  productId: string,
): Promise<StoreProduct | null> {
  const adapter = new PostgreSQLStoreAdapter()
  return adapter.getProductById(productId)
}
