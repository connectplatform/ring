'use client'

// Imports
import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { StoreProduct } from '@/features/store'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'
import { pickGalleryDisplayUrl } from '@/features/generative-media/types'
import { useStore } from '@/features/store/context'
import { useStoreCurrency, resolveStorePriceCurrency, type StoreCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n/shared'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

// TODO: Use React 19/Next.js 16 Server Actions (app/actions) for cart add-on for more robust UX and built-in loader state

// ERP Extension: Enhanced Product Card with Vendor Quality Data
interface EnhancedProductCardProps {
  product: StoreProduct
  locale: Locale
  vendorProfile?: ExtendedVendorProfile | null
  showQualityBadges?: boolean
  showTrustScore?: boolean
  showSustainabilityRating?: boolean
}

export function ProductCard({
  product,
  locale,
  vendorProfile,
  showQualityBadges = true,
  showTrustScore = true,
  showSustainabilityRating = false
}: EnhancedProductCardProps) {
  // Get cart mutation from store context
  const { addToCart } = useStore()

  // Currency state/formatter and conversion (SSOT: StoreCurrencyProvider)
  const {
    currency,
    convertPrice,
    formatPrice,
    equivalentCurrency,
    defaultCurrency,
  } = useStoreCurrency()

  const fromCurrency = resolveStorePriceCurrency(product.currency || defaultCurrency)
  const priceAmount = Number(product.price)
  const primaryPrice = formatPrice(
    convertPrice(priceAmount, fromCurrency, currency),
    currency,
  )
  const equivalentPrice = formatPrice(
    convertPrice(priceAmount, fromCurrency, equivalentCurrency),
    equivalentCurrency,
  )

  // --- Add to cart async UI state ---
  // TODO: Switch to React's useTransition for async UX (React 19+), and to useOptimistic for UI feedback
  // const [isPending, startTransition] = useTransition(); 
  // Would allow: startTransition(() => { ...async add to cart... })
  const [adding, setAdding] = useState(false)

  // Toasted success notification
  const { success } = useToast()

  // i18n translations for product module
  const t = useTranslations('modules.store.product')

  /**
   * Handle "Add to Cart" click handler.
   * Provides visual feedback while async action is pending.
   * TODO: Refactor to useTransition + useOptimistic for React 19 and Next 16 for optimal UX.
   */
  const handleAdd = async () => {
    if (adding) return // Prevent double-adds
    setAdding(true)
    try {
      await Promise.resolve(addToCart(product)) // Await add to cart action
      // Wait a short moment to signal success visually
      await new Promise(res => setTimeout(res, 600))
      // Success toast message with product name
      success({ title: t('addedToCart', { name: product.name }) })
    } finally {
      setAdding(false)
    }
  }

  /**
   * Render product/vendor badges for organic, fair trade, premium
   * Only shows if vendorProfile.compliance/qualityProfile present & enabled
   */
  const renderQualityBadges = () => {
    if (!showQualityBadges || !vendorProfile || !vendorProfile.qualityProfile) return null

    const { qualityProfile } = vendorProfile
    const badges: React.ReactNode[] = []

    // Organic badge if compliance marks organicCertified
    if (vendorProfile.compliance && vendorProfile.compliance.organicCertified) {
      badges.push(
        <span key="organic" className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
          🌱 Organic
        </span>
      )
    }
    // Fair trade badge if compliance marks fairTradeCertified
    if (vendorProfile.compliance && vendorProfile.compliance.fairTradeCertified) {
      badges.push(
        <span key="fairtrade" className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
          ⚖️ Fair Trade
        </span>
      )
    }
    // Premium quality badge if score high
    if (typeof qualityProfile.qualityScore === 'number' && qualityProfile.qualityScore >= 90) {
      badges.push(
        <span key="quality" className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
          ⭐ Premium Quality
        </span>
      )
    }

    // Display all applicable badges
    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mb-2">
        {badges}
      </div>
    ) : null
  }

  /**
   * Displays vendor 'trust score' with banded color/icon
   * Only rendered if vendor and score available
   */
  const renderTrustScore = () => {
    if (!showTrustScore || !vendorProfile || typeof vendorProfile.trustScore !== 'number') return null

    const trustScore = vendorProfile.trustScore

    // Get a text color class by trust score range
    const getTrustColor = (score: number) => {
      if (score >= 90) return 'text-green-600'
      if (score >= 70) return 'text-yellow-600'
      return 'text-red-600'
    }
    // Map to shield, scales, or warning
    const getTrustIcon = (score: number) => {
      if (score >= 90) return '🛡️'
      if (score >= 70) return '⚖️'
      return '⚠️'
    }

    return (
      <div className={`text-xs ${getTrustColor(trustScore)} flex items-center gap-1`}>
        <span>{getTrustIcon(trustScore)}</span>
        <span>Trust Score: {trustScore}/100</span>
      </div>
    )
  }

  /**
   * Optionally show vendor's sustainability/impact score
   */
  const renderSustainabilityRating = () => {
    if (!showSustainabilityRating || !vendorProfile || !vendorProfile.sustainability) return null

    const { socialImpactScore } = vendorProfile.sustainability

    return typeof socialImpactScore === 'number' ? (
      <div className="text-xs text-blue-600 flex items-center gap-1">
        <span>🌍</span>
        <span>Sustainability: {socialImpactScore}/100</span>
      </div>
    ) : null
  }

  /**
   * Displays AI recommendation badge if vendor AI insights contain keywords
   */
  const renderAiRecommendation = () => {
    // Validate presence & format
    if (
      !vendorProfile ||
      !vendorProfile.aiInsights ||
      !Array.isArray(vendorProfile.aiInsights.recommendedActions) ||
      !vendorProfile.aiInsights.recommendedActions.length
    ) return null

    // Check if any recommended action mentions quality/premium/recommended
    const hasRecommendation = vendorProfile.aiInsights.recommendedActions.some(
      action =>
        typeof action === 'string' &&
        (action.toLowerCase().includes('quality') ||
          action.toLowerCase().includes('premium') ||
          action.toLowerCase().includes('recommended'))
    )

    if (!hasRecommendation) return null

    return (
      <div className="text-xs text-purple-600 flex items-center gap-1 font-medium">
        <span>🤖</span>
        <span>AI Recommended</span>
      </div>
    )
  }

  /**
   * Generate product category name: capitalized, hyphens replaced with spaces
   */
  const getCategory = () => {
    if (product.category && typeof product.category === 'string') {
      // E.g. "organic-foods" -> "Organic foods"
      return product.category.charAt(0).toUpperCase() + product.category.slice(1).replace(/-/g, ' ')
    }
    return null
  }

  /**
   * Extract description excerpt (max 160 chars, add ellipsis if longer)
   */
  const getDescriptionExcerpt = () => {
    const desc = product.description
    if (!desc || typeof desc !== 'string') return null
    return desc.length > 160 ? desc.slice(0, 160) + '...' : desc
  }

  // Prefer generativeGallery card/thumb when present; else first images[] URL
  const galleryItems = product.generativeGallery?.items
  const primaryGalleryItem =
    galleryItems?.find((i) => i.isPrimary && i.enabled) ||
    galleryItems?.find((i) => i.enabled) ||
    galleryItems?.[0]
  const cardImageSrc = primaryGalleryItem
    ? pickGalleryDisplayUrl(primaryGalleryItem, 'card') ||
      pickGalleryDisplayUrl(primaryGalleryItem, 'thumb') ||
      primaryGalleryItem.webpUrl ||
      primaryGalleryItem.originalUrl
    : Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : ''

  // TODO: Use next/image's <Image /> for auto lazy loading and better webperf. Example available in Next.js docs.
  // Can replace <img> below with:
  // <Image src={product.images[0]} alt={product.name} fill className="..." />

  return (
    <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-background">
      {/* Product Image display. Should use next/image for best perf. */}
      <Link
        href={`${ROUTES.STORE(locale.toLowerCase() as Locale)}/${product.id}`}
        className="block relative aspect-square overflow-hidden"
      >
        {cardImageSrc ? (
          // TODO: Replace with <Image /> as described above.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardImageSrc}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Fallback: No product image, show icon illustration
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <svg className="w-16 h-16 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Category badge (top left of image) */}
        {getCategory() && (
          <div className="absolute top-3 left-3">
            <div className="bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
              {getCategory()}
            </div>
          </div>
        )}

        {/* Inline quality badges (organic/fair trade) overlay at top-right. 
            Note: This partially duplicates logic from renderQualityBadges for overlay UX */}
        {showQualityBadges && vendorProfile && vendorProfile.qualityProfile && (
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {vendorProfile.compliance && vendorProfile.compliance.organicCertified && (
              <span className="bg-green-100/90 text-green-800 text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                🌱 Organic
              </span>
            )}
            {vendorProfile.compliance && vendorProfile.compliance.fairTradeCertified && (
              <span className="bg-blue-100/90 text-blue-800 text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                ⚖️ Fair Trade
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Content: product title, desc, badges+vendor, price/stock/actions */}
      <div className="p-4 space-y-3">
        {/* Product name heading, links to product */}
        <Link href={`${ROUTES.STORE(locale.toLowerCase() as Locale)}/${product.id}`}>
          <h3 className="font-semibold text-base hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>

        {/* Description excerpt if available */}
        {getDescriptionExcerpt() && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {getDescriptionExcerpt()}
          </p>
        )}

        {/* Composite badges and scores: trust, sustainability, AI */}
        <div className="flex flex-wrap gap-2 text-xs">
          {renderTrustScore()}
          {renderSustainabilityRating()}
          {renderAiRecommendation()}
        </div>

        {/* Vendor info: vendor name, possible satisfaction star */}
        {(vendorProfile || product.vendorName) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium">
              {/* STUB: Vendor display logic: future step - replace with vendor link/profile avatar when available */}
              {product.vendorName ? product.vendorName : (vendorProfile && vendorProfile.entityId ? vendorProfile.entityId : '')}
            </span>
            {/* Show satisfaction score if available (vendor analytics) */}
            {vendorProfile && vendorProfile.analytics && typeof vendorProfile.analytics.customerSatisfactionScore === 'number' && (
              <span className="ml-1">★ {vendorProfile.analytics.customerSatisfactionScore}/5</span>
            )}
          </div>
        )}

        {/* Price, stock, and action row */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex flex-col">
            <span className="text-lg font-bold">{primaryPrice}</span>
            <span className="text-xs text-muted-foreground">≈ {equivalentPrice}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Stock status label */}
            <span className={`text-xs font-medium ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
              {product.inStock ? t('inStockYes') : t('inStockNo')}
            </span>
            {/* Add to cart / preorder button */}
            {/* TODO: Replace with <Button /> and useTransition for server actions when React 19/Next 16 is live */}
            <button
              className={`text-sm font-medium underline hover:no-underline transition-colors ${
                adding ? 'opacity-60 cursor-not-allowed animate-pulse' : ''
              } ${!product.inStock ? 'text-amber-600 hover:text-amber-700' : 'text-primary hover:text-primary/80'}`}
              onClick={handleAdd}
              disabled={adding}
              aria-busy={adding}
              aria-label={
                adding
                  ? t('adding')
                  : (product.inStock ? t('addToCart') : t('preorder'))
              }
              type="button"
            >
              {adding ? t('adding') : (product.inStock ? t('addToCart') : t('preorder'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
