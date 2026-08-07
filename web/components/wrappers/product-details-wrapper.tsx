'use client'

/**
 * Desktop product right rail: collapsible always-on agent (lower half).
 * Welcome is generic i18n — no LLM call for greetings.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { ProductAgentChatProvider } from '@/features/store/context/product-agent-chat-context'
import { ProductAgentChatShell } from '@/features/store/components/product-agent-chat-shell'
import { ProductAgentChatPanel } from '@/features/store/components/product-agent-chat-panel'
import { ProductAgentCartSummaryBar } from '@/features/store/components/product-agent-cart-summary'
import StoreProductRightSidebar from '@/components/store/store-product-right-sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  const t = useTranslations('modules.store')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [agentExpanded, setAgentExpanded] = useState(true)
  const resolvedProductId = productId || currentProduct.id

  const scrollToReviews = useCallback(() => {
    if (typeof document === 'undefined') return
    window.dispatchEvent(new CustomEvent('store:open-product-reviews'))
    const el = document.getElementById('product-reviews')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setRightSidebarOpen(false)
  }, [])

  const rightRail = useMemo(
    () => (
      <div className="flex h-[calc(100dvh-2rem)] min-h-[28rem] max-h-[calc(100dvh-1rem)] flex-col">
        <div
          className={cn(
            'min-h-0 overflow-y-auto pr-0.5',
            agentExpanded ? 'flex-1' : 'flex-[2]',
          )}
        >
          <StoreProductRightSidebar
            locale={locale}
            railData={railData}
            productName={currentProduct.name}
            onScrollToReviews={scrollToReviews}
          />
        </div>

        {resolvedProductId ? (
          <div
            className={cn(
              'hidden min-h-0 flex-col border-t border-border/60 pt-2 md:flex',
              agentExpanded ? 'flex-1' : 'shrink-0',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <p className="truncate text-xs font-medium text-muted-foreground">
                {t('product.aiSalesAssistant')}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setAgentExpanded((v) => !v)}
                aria-expanded={agentExpanded}
              >
                {agentExpanded ? (
                  <>
                    <ChevronDown className="mr-1 h-3.5 w-3.5" />
                    {t('product.agentRailCollapse')}
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-1 h-3.5 w-3.5" />
                    {t('product.agentRailExpand')}
                  </>
                )}
              </Button>
            </div>
            {agentExpanded ? (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <ProductAgentCartSummaryBar locale={locale} productId={resolvedProductId} />
                <ProductAgentChatPanel
                  productId={resolvedProductId}
                  productName={currentProduct.name}
                  locale={locale}
                  className="min-h-0 flex-1"
                />
              </div>
            ) : (
              <p className="px-1 pb-1 text-xs text-muted-foreground line-clamp-2">
                {t('product.agentWelcome', { name: currentProduct.name })}
              </p>
            )}
          </div>
        ) : null}
      </div>
    ),
    [
      locale,
      railData,
      currentProduct.name,
      scrollToReviews,
      resolvedProductId,
      agentExpanded,
      t,
    ],
  )

  return (
    <ProductAgentChatProvider
      productId={resolvedProductId}
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
        railWidth={360}
      >
        <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
      </RingRightRailLayout>

      {resolvedProductId ? <ProductAgentChatShell locale={locale} /> : null}
    </ProductAgentChatProvider>
  )
}
