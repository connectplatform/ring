'use client'

// Imports
import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { StoreProduct } from '@/features/store'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'
import { pickGalleryDisplayUrl } from '@/features/generative-media/types'
import { useStore } from '@/features/store/context'
import { useStorePaymentMethods, resolveStorePriceCurrency, type StorePaymentMethods } from '@/features/store/currency-context'
import type { Locale } from '@/i18n/shared'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'
import { useStoreCategoryName } from '@/lib/store-category-display'
import NicheProductCardMeta from '@/components/store/niche-product-card-meta'
import { nicheSuppressesCart } from '@/features/store/niche/niche-commerce'
import { applyProductPromotionToLine, formatPromotionBadge, isPromotionActive } from '@/features/store/types/promotions'

// TODO: Use React 19/Next.js 16 Server Actions (app/actions) for cart add-on for more robust UX and built-in loader state

/** Card/thumb URL, or '' when the product has nothing to paint. */
export function productCardImageSrc(product: StoreProduct): string {
  const galleryItems = product.generativeGallery?.items
  const primaryGalleryItem =
    galleryItems?.find((i) => i.isPrimary && i.enabled) ||
    galleryItems?.find((i) => i.enabled) ||
    galleryItems?.[0]
  if (primaryGalleryItem) {
    return (
      pickGalleryDisplayUrl(primaryGalleryItem, 'card') ||
      pickGalleryDisplayUrl(primaryGalleryItem, 'thumb') ||
      primaryGalleryItem.webpUrl ||
      primaryGalleryItem.originalUrl ||
      ''
    )
  }
  return Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : ''
}

/**
 * A physical line is empty when one warehouse cannot ship even one unit.
 * Catalog `inStock` can stay true while every warehouse is at zero.
 */
export function shelfIsEmpty(
  product: StoreProduct,
  shippableMax?: number | null,
): boolean {
  if (product.digitalProduct || product.instantDelivery) return false
  if (shippableMax === null) return false
  if (typeof shippableMax === 'number') return shippableMax <= 0
  if (product.inStock === false) return true
  if (typeof product.stock === 'number') return product.stock <= 0
  return false
}

// ERP Extension: Enhanced Product Card with Vendor Quality Data
interface EnhancedProductCardProps {
  product: StoreProduct
  locale: Locale
  vendorProfile?: ExtendedVendorProfile | null
  showQualityBadges?: boolean
  showTrustScore?: boolean
  showSustainabilityRating?: boolean
  /** `plain` skips the photo well. The store list uses this for the no-photo section. */
  layout?: 'photo' | 'plain'
  /** Fired when a URL is missing or the image fails, so the list can regroup. */
  onImageUnavailable?: (productId: string) => void
  /**
   * Largest quantity one warehouse can ship. `0` is an empty shelf even when
   * the catalog `inStock` flag is still true. `null` means stock is not physical.
   */
  shippableMax?: number | null
}

export function ProductCard({
  product,
  locale,
  vendorProfile,
  showQualityBadges = true,
  showTrustScore = true,
  showSustainabilityRating = false,
  layout = 'photo',
  onImageUnavailable,
  shippableMax,
}: EnhancedProductCardProps) {
  // Get cart mutation from store context
  const { addToCart, addBackorder, cartItems } = useStore()
  const inCart = cartItems.some((item) => item.product?.id === product.id)

  // Currency state/formatter and conversion (SSOT: StorePaymentMethodsProvider)
  const {
    currency,
    convertPrice,
    formatPrice,
    mainCurrency,
  } = useStorePaymentMethods()

  const fromCurrency = resolveStorePriceCurrency(product.currency || mainCurrency)
  const priceAmount = Number(product.price)
  const activePromo = (product.promotions || []).find((promo) => isPromotionActive(promo))
  const promotedUnit =
    activePromo && (activePromo.type === 'percent_off' || activePromo.type === 'amount_off')
      ? applyProductPromotionToLine(priceAmount, 1, [activePromo]).lineTotal
      : priceAmount
  const primaryPrice = formatPrice(
    convertPrice(promotedUnit, fromCurrency, currency),
    currency,
  )
  const listPrice = formatPrice(
    convertPrice(priceAmount, fromCurrency, currency),
    currency,
  )

  // --- Add to cart async UI state ---
  // TODO: Switch to React's useTransition for async UX (React 19+), and to useOptimistic for UI feedback
  // const [isPending, startTransition] = useTransition(); 
  // Would allow: startTransition(() => { ...async add to cart... })
  const [adding, setAdding] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  // Toasted success notification
  const { success } = useToast()

  // i18n translations for product module
  const t = useTranslations('modules.store.product')
  const fulfillment = useTranslations('modules.store.fulfillment')

  /**
   * Handle "Add to Cart" click handler.
   * Provides visual feedback while async action is pending.
   * TODO: Refactor to useTransition + useOptimistic for React 19 and Next 16 for optimal UX.
   */
  const handleAdd = async () => {
    if (adding) return // Prevent double-adds
    setAdding(true)
    try {
      const result = await addToCart(product)
      if (!result.ok) {
        success({
          title: fulfillment('oneWarehouse'),
          description: result.max != null ? fulfillment('shortfall', { max: result.max }) : undefined,
        })
        return
      }
      await new Promise(res => setTimeout(res, 600))
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
   * Localized product category name via `modules.store.categories.<slug>`
   * (prettified-slug fallback for slugs without a locale key yet).
   */
  const categoryName = useStoreCategoryName(
    typeof product.category === 'string' ? product.category : null,
  )

  const getCategory = () => categoryName

  /**
   * Extract description excerpt (max 160 chars, add ellipsis if longer)
   */
  const getDescriptionExcerpt = () => {
    const desc = product.description
    if (!desc || typeof desc !== 'string') return null
    return desc.length > 160 ? desc.slice(0, 160) + '...' : desc
  }

  const cardImageSrc = productCardImageSrc(product)
  const showPhoto = layout === 'photo' && Boolean(cardImageSrc) && !imageFailed
  const vendorLabel = product.vendorName?.trim() || ''
  const leftChip = vendorLabel || getCategory()
  const outOfStock = shelfIsEmpty(product, shippableMax)
  const stockLabel = outOfStock ? t('inStockNo') : t('inStockYes')
  const productHref = `${ROUTES.STORE(locale.toLowerCase() as Locale)}/${product.id}`
  const cartHref = ROUTES.CART(locale.toLowerCase() as Locale)
  const cartLabel = adding
    ? t('adding')
    : outOfStock
      ? t('backorder')
      : inCart
        ? t('inCart')
        : t('addToCart')

  const markUnavailable = () => {
    setImageFailed(true)
    onImageUnavailable?.(product.id)
  }

  const priceBlock = (
    <div className="mr-auto min-w-0">
      <p className="whitespace-nowrap text-lg font-bold tabular-nums leading-none">{primaryPrice}</p>
      {activePromo && promotedUnit < priceAmount ? (
        <p className="mt-1 text-xs text-muted-foreground line-through">{listPrice}</p>
      ) : null}
    </div>
  )

  const handleBackorder = () => {
    addBackorder(product)
    success({ title: t('backorderSent', { name: product.name }) })
  }

  const cartAction = nicheSuppressesCart(product) ? null : outOfStock ? (
    <button
      className="shrink-0 whitespace-nowrap text-sm font-semibold leading-none text-muted-foreground underline-offset-2 hover:underline"
      onClick={handleBackorder}
      type="button"
      aria-label={t('backorder')}
    >
      {t('backorder')}
    </button>
  ) : inCart && !adding ? (
    <Link
      href={cartHref}
      className="shrink-0 whitespace-nowrap text-sm font-semibold leading-none text-primary underline-offset-2 hover:underline"
      aria-label={t('inCart')}
    >
      {t('inCart')}
    </Link>
  ) : (
    <button
      className={`shrink-0 whitespace-nowrap text-sm font-semibold leading-none underline-offset-2 hover:underline ${
        adding ? 'cursor-not-allowed opacity-60' : ''
      } text-primary`}
      onClick={handleAdd}
      disabled={adding}
      aria-busy={adding}
      aria-label={cartLabel}
      type="button"
    >
      {cartLabel}
    </button>
  )

  const stockChip = (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold leading-none backdrop-blur-sm ${
        outOfStock
          ? 'bg-muted/90 text-muted-foreground'
          : 'bg-background/90 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {stockLabel}
    </span>
  )

  if (!showPhoto) {
    return (
      <div className="flex gap-3 rounded-xl border bg-background p-3">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          aria-hidden
        >
          <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            {leftChip ? (
              <span className="truncate text-xs font-semibold text-primary">{leftChip}</span>
            ) : null}
            <span className={`ml-auto shrink-0 text-xs font-semibold ${outOfStock ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {stockLabel}
            </span>
          </div>
          <Link href={productHref}>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">{product.name}</h3>
          </Link>
          <div className="mt-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-2">
            {priceBlock}
            {cartAction}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group overflow-hidden rounded-xl border bg-background transition-shadow duration-300 hover:shadow-lg">
      <Link href={productHref} className="relative block aspect-video overflow-hidden bg-muted">
        {/* Hidden until load so a dead URL never paints the broken-image icon. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardImageSrc}
          alt={product.name}
          className={`h-full w-full object-cover object-center transition duration-300 group-hover:scale-105 ${
            imageReady ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageReady(true)}
          onError={markUnavailable}
        />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {leftChip ? (
            <span className="max-w-[68%] truncate rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
              {leftChip}
            </span>
          ) : null}
          <span className="ml-auto">{stockChip}</span>
        </div>

        {activePromo ? (
          <div className="absolute bottom-3 left-3">
            <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground shadow-sm">
              {formatPromotionBadge(activePromo)}
            </span>
          </div>
        ) : null}
        {showQualityBadges && vendorProfile?.qualityProfile ? (
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
            {vendorProfile.compliance?.organicCertified ? (
              <span className="rounded-full bg-green-100/90 px-2 py-1 text-xs font-medium text-green-800 backdrop-blur-sm">
                Organic
              </span>
            ) : null}
            {vendorProfile.compliance?.fairTradeCertified ? (
              <span className="rounded-full bg-blue-100/90 px-2 py-1 text-xs font-medium text-blue-800 backdrop-blur-sm">
                Fair Trade
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>

      <div className="space-y-3 p-4">
        <Link href={productHref}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-base font-semibold leading-snug hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <NicheProductCardMeta product={product} />

        {getDescriptionExcerpt() ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{getDescriptionExcerpt()}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs">
          {renderTrustScore()}
          {renderSustainabilityRating()}
          {renderAiRecommendation()}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t pt-3">
          {priceBlock}
          {cartAction}
        </div>
      </div>
    </div>
  )
}
