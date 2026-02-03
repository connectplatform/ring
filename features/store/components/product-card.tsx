'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { StoreProduct } from '@/features/store'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'
import { useStore } from '@/features/store/context'
import { useCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n-config'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

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
  const { addToCart } = useStore()
  const { currency, convertPrice, formatPrice: formatCurrencyPrice } = useCurrency()
  const [adding, setAdding] = useState(false)
  const { success } = useToast()
  const t = useTranslations('modules.store.product')

  const handleAdd = async () => {
    if (adding) return
    setAdding(true)
    try {
      await Promise.resolve(addToCart(product))
      // Ensure the visual state is noticeable
      await new Promise(res => setTimeout(res, 600))
      success({ title: t('addedToCart', { name: product.name }) })
    } finally {
      setAdding(false)
    }
  }

  // ERP Extension: Quality badge rendering
  const renderQualityBadges = () => {
    if (!showQualityBadges || !vendorProfile?.qualityProfile) return null

    const { qualityProfile } = vendorProfile
    const badges = []

    // Organic certification badge
    if (vendorProfile.compliance?.organicCertified) {
      badges.push(
        <span key="organic" className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
          🌱 Organic
        </span>
      )
    }

    // Fair trade certification badge
    if (vendorProfile.compliance?.fairTradeCertified) {
      badges.push(
        <span key="fairtrade" className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
          ⚖️ Fair Trade
        </span>
      )
    }

    // Quality score badge
    if (qualityProfile.qualityScore >= 90) {
      badges.push(
        <span key="quality" className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
          ⭐ Premium Quality
        </span>
      )
    }

    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mb-2">
        {badges}
      </div>
    ) : null
  }

  // ERP Extension: Trust score display
  const renderTrustScore = () => {
    if (!showTrustScore || !vendorProfile?.trustScore) return null

    const trustScore = vendorProfile.trustScore
    const getTrustColor = (score: number) => {
      if (score >= 90) return 'text-green-600'
      if (score >= 70) return 'text-yellow-600'
      return 'text-red-600'
    }

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

  // ERP Extension: Sustainability rating
  const renderSustainabilityRating = () => {
    if (!showSustainabilityRating || !vendorProfile?.sustainability) return null

    const { socialImpactScore } = vendorProfile.sustainability

    return (
      <div className="text-xs text-blue-600 flex items-center gap-1">
        <span>🌍</span>
        <span>Sustainability: {socialImpactScore}/100</span>
      </div>
    )
  }

  // ERP Extension: AI recommendations
  const renderAiRecommendation = () => {
    if (!vendorProfile?.aiInsights?.recommendedActions?.length) return null

    const hasRecommendation = vendorProfile.aiInsights.recommendedActions.some(
      action => action.toLowerCase().includes('quality') ||
               action.toLowerCase().includes('premium') ||
               action.toLowerCase().includes('recommended')
    )

    if (!hasRecommendation) return null

    return (
      <div className="text-xs text-purple-600 flex items-center gap-1 font-medium">
        <span>🤖</span>
        <span>AI Recommended</span>
      </div>
    )
  }

  // Get product category for display
  const getCategory = () => {
    if (product.category) {
      return product.category.charAt(0).toUpperCase() + product.category.slice(1).replace(/-/g, ' ')
    }
    return null
  }

  // Get description excerpt (160 chars)
  const getDescriptionExcerpt = () => {
    const desc = product.description
    if (!desc) return null
    return desc.length > 160 ? desc.slice(0, 160) + '...' : desc
  }

  return (
    <div className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-background">
      {/* Product Image - Top 67% - Square with rounded corners */}
      <Link href={`${ROUTES.STORE(locale)}/${product.id}`} className="block relative aspect-square overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <svg className="w-16 h-16 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Category Badge Overlay */}
        {getCategory() && (
          <div className="absolute top-3 left-3">
            <div className="bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
              {getCategory()}
            </div>
          </div>
        )}

        {/* Quality Badges Overlay */}
        {showQualityBadges && vendorProfile?.qualityProfile && (
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {vendorProfile.compliance?.organicCertified && (
              <span className="bg-green-100/90 text-green-800 text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                🌱 Organic
              </span>
            )}
            {vendorProfile.compliance?.fairTradeCertified && (
              <span className="bg-blue-100/90 text-blue-800 text-xs px-2 py-1 rounded-full font-medium backdrop-blur-sm">
                ⚖️ Fair Trade
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Product Details - Bottom 33% */}
      <div className="p-4 space-y-3">
        {/* Product Title */}
        <Link href={`${ROUTES.STORE(locale)}/${product.id}`}>
          <h3 className="font-semibold text-base hover:text-primary transition-colors line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>

        {/* Description Excerpt */}
        {getDescriptionExcerpt() && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {getDescriptionExcerpt()}
          </p>
        )}

        {/* ERP Extension: Trust score and sustainability */}
        <div className="flex flex-wrap gap-2 text-xs">
          {renderTrustScore()}
          {renderSustainabilityRating()}
          {renderAiRecommendation()}
        </div>

        {/* ERP Extension: Vendor information */}
        {(vendorProfile || product.vendorName) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-medium">
              {product.vendorName || vendorProfile?.entityId}
            </span>
            {vendorProfile?.analytics?.customerSatisfactionScore && (
              <span className="ml-1">★ {vendorProfile.analytics.customerSatisfactionScore}/5</span>
            )}
          </div>
        )}

        {/* Price and Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex flex-col">
            <span className="text-lg font-bold">
              {formatCurrencyPrice(convertPrice(Number(product.price)))}
            </span>
              <span className="text-xs text-muted-foreground">
              ≈ {currency === 'UAH'
                ? `${(Number(product.price) * 0.025).toFixed(2)} DAAR`
                : `${(Number(product.price)).toFixed(2)} ₴`}
              </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Stock Status */}
            <span className={`text-xs font-medium ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
              {product.inStock ? t('inStockYes') : t('inStockNo')}
            </span>
            
            {/* Add to Cart / Preorder Button */}
            <button
              className={`text-sm font-medium underline hover:no-underline transition-colors ${
                adding ? 'opacity-60 cursor-not-allowed animate-pulse' : ''
              } ${!product.inStock ? 'text-amber-600 hover:text-amber-700' : 'text-primary hover:text-primary/80'}`}
              onClick={handleAdd}
              disabled={adding}
              aria-busy={adding}
              aria-label={adding ? t('adding') : (product.inStock ? t('addToCart') : t('preorder'))}
            >
              {adding ? t('adding') : (product.inStock ? t('addToCart') : t('preorder'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


