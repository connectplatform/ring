'use client'

/**
 * Product details shell.
 *
 * Desktop: center pane + right rail fully dedicated to the product agent chat
 * (full viewport height). Seller info lives in the Reviews tab and the
 * similar-products / seller-products rails live in the center pane (see
 * productDetailsClient) — the rail renders chat only.
 *
 * Mobile: the right rail is not exposed (no floating gear toggle); the chat is
 * activated via FloatingProductChatToggle → ProductAgentChatShell overlay.
 */

import React, { useMemo } from 'react'
import type { Locale } from '@/i18n/shared'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import {
  ProductAgentChatProvider,
  useProductAgentChatContext,
} from '@/features/store/context/product-agent-chat-context'
import { ProductAgentChatShell } from '@/features/store/components/product-agent-chat-shell'
import { ProductAgentChatPanel } from '@/features/store/components/product-agent-chat-panel'
import { ProductAgentCartSummaryBar } from '@/features/store/components/product-agent-cart-summary'
import FloatingProductChatToggle from '@/components/store/floating-product-chat-toggle'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { StoreProduct } from '@/features/store/types'

interface ProductDetailsWrapperProps {
  children: React.ReactNode
  locale: Locale
  productId?: string
  currentProduct: StoreProduct
}

export default function ProductDetailsWrapper({
  children,
  locale,
  productId,
  currentProduct,
}: ProductDetailsWrapperProps) {
  const isDesktopRail = useMediaQuery('(min-width: 1024px)')
  const resolvedProductId = productId || currentProduct.id

  // Right rail = product agent chat only, occupying the full viewport height.
  const rightRail = useMemo(
    () => (
      <div className="flex h-[calc(100dvh-2.5rem)] min-h-[28rem] flex-col">
        {isDesktopRail && resolvedProductId ? (
          <>
            <ProductAgentCartSummaryBar locale={locale} productId={resolvedProductId} />
            <ProductAgentChatPanel
              productId={resolvedProductId}
              productName={currentProduct.name}
              locale={locale}
              className="min-h-0 flex-1"
            />
          </>
        ) : null}
      </div>
    ),
    [locale, currentProduct.name, resolvedProductId, isDesktopRail],
  )

  return (
    <ProductAgentChatProvider
      productId={resolvedProductId}
      productName={currentProduct.name}
    >
      <RingRightRailLayout
        showRightRail
        flushCenterPane
        mobileRailMode="overlay"
        rightRailPurpose="store-product"
        rightRail={rightRail}
        railWidth={360}
        // Mobile chat is driven by FloatingProductChatToggle + ChatShell instead.
        toggleOptions={{ showFloatingButton: false }}
      >
        <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
      </RingRightRailLayout>

      {resolvedProductId ? (
        <>
          <FloatingProductChatToggle />
          <ProductAgentChatShell locale={locale} />
        </>
      ) : null}
    </ProductAgentChatProvider>
  )
}
