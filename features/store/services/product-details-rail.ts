/**
 * Server loader for store product details right rail + related carousel.
 */

import 'server-only'

import { getMainCurrencySymbol } from '@/lib/ring-config-core'

import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { PostgreSQLStoreAdapter } from '@/features/store/postgresql-adapter'
import { getVendorProfile } from '@/features/store/services/vendor-profile'
import { getProductReviews, type ProductReviewsResult } from '@/features/store/services/product-reviews'
import type { StoreProduct } from '@/features/store/types'

export type RailProductCard = {
  id: string
  name: string
  image: string
  price: number
  currency: string
  rating?: number
  reviewCount?: number
  inStock: boolean
  category?: string
  url: string
  featured?: boolean
}

export type ProductDetailsVendorRail = {
  id: string
  name: string
  memberSince: string
  href: string
  verified: boolean
  trustScore?: number
}

export type ProductDetailsRailData = {
  vendor: ProductDetailsVendorRail | null
  reviews: Pick<ProductReviewsResult, 'averageRating' | 'totalReviews' | 'distribution'>
  categoryProducts: RailProductCard[]
  featuredSellerProducts: RailProductCard[]
  relatedProducts: RailProductCard[]
}

function toCard(product: StoreProduct, locale: Locale): RailProductCard {
  const images = product.images || []
  return {
    id: product.id,
    name: product.name,
    image: images[0] || '/placeholder-product.png',
    price: parseFloat(product.price) || 0,
    currency: product.currency || getMainCurrencySymbol(),
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.inStock ?? (product.stock || 0) > 0,
    category: product.category,
    url: `${ROUTES.STORE(locale)}/${product.id}`,
    featured: Boolean(product.featured),
  }
}

function formatMemberSince(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function resolveVendorEntityId(product: StoreProduct): string | null {
  if (product.ownerEntityId) return product.ownerEntityId
  const owner = product.productOwner
  if (!owner) return null
  return owner.startsWith('vendor_') ? owner.slice('vendor_'.length) : owner
}

export async function loadProductDetailsRailData(params: {
  product: StoreProduct
  locale: Locale
  reviews?: ProductReviewsResult
}): Promise<ProductDetailsRailData> {
  const { product, locale } = params
  const reviews = params.reviews ?? (await getProductReviews(product.id))

  const adapter = new PostgreSQLStoreAdapter()
  const all = await adapter.listProducts()
  const others = all.filter((p) => p.id !== product.id)

  const categoryProducts = product.category
    ? others
        .filter((p) => p.category === product.category)
        .slice(0, 6)
        .map((p) => toCard(p, locale))
    : []

  const vendorEntityId = resolveVendorEntityId(product)
  const vendorOwner = product.productOwner

  const sellerPool = others.filter((p) => {
    if (vendorOwner && p.productOwner === vendorOwner) return true
    if (vendorEntityId && p.ownerEntityId === vendorEntityId) return true
    if (vendorOwner && p.ownerEntityId === vendorOwner) return true
    return false
  })

  const featuredSellerProducts = (
    sellerPool.filter((p) => p.featured).length
      ? sellerPool.filter((p) => p.featured)
      : sellerPool
  )
    .slice(0, 6)
    .map((p) => toCard(p, locale))

  const relatedProducts = (categoryProducts.length ? categoryProducts : featuredSellerProducts).slice(
    0,
    8,
  )

  let vendor: ProductDetailsVendorRail | null = null
  if (vendorEntityId) {
    const profile = await getVendorProfile(vendorEntityId)
    const name =
      profile?.storeName ||
      profile?.businessName ||
      product.vendorName ||
      'Vendor'
    const memberSince = formatMemberSince(
      profile?.createdAt || profile?.onboardingStartedAt || profile?.onboardingCompletedAt,
    )
    vendor = {
      id: profile?.id || `vendor_${vendorEntityId}`,
      name,
      memberSince,
      href: `/store/vendors/${vendorEntityId}`,
      verified: (profile?.trustScore ?? 0) >= 50 || Boolean(profile?.onboardingCompletedAt),
      trustScore: profile?.trustScore,
    }
  } else if (product.vendorName) {
    vendor = {
      id: 'unknown',
      name: product.vendorName,
      memberSince: '—',
      href: ROUTES.STORE(locale),
      verified: false,
    }
  }

  return {
    vendor,
    reviews: {
      averageRating: reviews.averageRating,
      totalReviews: reviews.totalReviews,
      distribution: reviews.distribution,
    },
    categoryProducts,
    featuredSellerProducts,
    relatedProducts,
  }
}
