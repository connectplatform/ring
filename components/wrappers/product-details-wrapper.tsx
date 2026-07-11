'use client'

/**
 * Product details wrapper — Davinci glass + consecutive mobile rail (wallet/store SSOT).
 */

import React, { useCallback, useMemo, useState } from 'react'
import type { Locale } from '@/i18n/shared'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { ProductAgentChatProvider } from '@/features/store/context/product-agent-chat-context'
import { ProductAgentChatShell } from '@/features/store/components/product-agent-chat-shell'
import StoreProductRightSidebar from '@/components/store/store-product-right-sidebar'
import type { StoreProduct } from '@/features/store/types'
import type { ProductDetailsRailData } from '@/features/store/services/product-details-rail'

interface ProductDetailsWrapperProps {
  children: React.ReactNode
  locale: Locale
  productId?: string
  currentProduct: StoreProduct
  railData: ProductDetailsRailData
}

export default function ProductDetailsWrapper({
  children,
  locale,
  productId,
  currentProduct,
  railData,
}: ProductDetailsWrapperProps) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const scrollToReviews = useCallback(() => {
    if (typeof document === 'undefined') return
    window.dispatchEvent(new CustomEvent('store:open-product-reviews'))
    const el = document.getElementById('product-reviews')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setRightSidebarOpen(false)
  }, [])

  const rightRail = useMemo(
    () => (
      <StoreProductRightSidebar
        locale={locale}
        railData={railData}
        productName={currentProduct.name}
        onScrollToReviews={scrollToReviews}
      />
    ),
    [locale, railData, currentProduct.name, scrollToReviews],
  )

  return (
    <ProductAgentChatProvider
      productId={productId || currentProduct.id}
      productName={currentProduct.name}
    >
      <RingRightRailLayout
        showRightRail
        flushCenterPane
        mobileRailMode="consecutive"
        rightRailPurpose="store-product"
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        rightRail={rightRail}
      >
        <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
      </RingRightRailLayout>

      {productId && currentProduct.id ? (
        <ProductAgentChatShell locale={locale} />
      ) : null}
    </ProductAgentChatProvider>
  )
}
