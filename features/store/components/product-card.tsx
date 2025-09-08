'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { StoreProduct } from '@/features/store'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'
import { useStore } from '@/features/store/context'
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

  return (
    <div className="border rounded p-4 hover:shadow-md transition-shadow">
      {/* ERP Extension: Quality badges */}
      {renderQualityBadges()}

      <Link href={`${ROUTES.STORE(locale)}/${product.id}`} className="font-medium underline hover:text-blue-600">
        {product.name}
      </Link>

      {product.description && (
        <div className="text-sm text-muted-foreground mb-2">{product.description}</div>
      )}

      <div className="text-sm font-medium mb-2">
        {t('price')}: {product.price} {product.currency}
      </div>

      {/* ERP Extension: Trust score and sustainability */}
      <div className="space-y-1 mb-3">
        {renderTrustScore()}
        {renderSustainabilityRating()}
        {renderAiRecommendation()}
      </div>

      {/* ERP Extension: Vendor information */}
      {vendorProfile && (
        <div className="text-xs text-muted-foreground mb-3">
          <div>Sold by: {vendorProfile.entityId}</div>
          {vendorProfile.analytics?.customerSatisfactionScore && (
            <div>★ {vendorProfile.analytics.customerSatisfactionScore}/5 rating</div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {t('inStock')}: {product.inStock ? '✅ Available' : '❌ Out of Stock'}
        </div>
        <button
          className={`underline hover:text-blue-600 ${
            adding ? 'opacity-60 cursor-not-allowed animate-pulse' : ''
          } ${!product.inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleAdd}
          disabled={adding || !product.inStock}
          aria-busy={adding}
          aria-label={adding ? t('adding') : t('addToCart')}
        >
          {adding ? t('adding') : t('addToCart')}
        </button>
      </div>
    </div>
  )
}


