'use client'

/**
 * Desktop product right rail: collapsible always-on agent (lower half).
 * Welcome is generic i18n — no LLM call for greetings.
 */

import React, { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import StoreProductRightSidebar from '@/components/store/store-product-right-sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { StoreProduct } from '@/features/store/types'
import type { ProductDetailsRailData } from '@/features/store/services/product-details-rail'

interface ProductDetailsWrapperProps {
  children: React.ReactNode
  locale: Locale
  productId?: string
  currentProduct: StoreProduct
  railData: ProductDetailsRailData
}

function ProductAgentFloatingChatButton() {
  const t = useTranslations('modules.store')
  const { setOpen, open } = useProductAgentChatContext()

  return (
    <div className="fixed right-4 top-[calc(50%+4rem)] z-50 -translate-y-1/2 md:hidden">
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="sm"
        variant="secondary"
        className="h-12 w-12 rounded-full border border-primary/50 bg-background/90 p-0 shadow-lg backdrop-blur-sm transition-all duration-200 hover:bg-background"
        aria-label={t('product.agentRailLabel')}
        aria-pressed={open}
        title={t('product.agentRailLabel')}
        data-product-agent-chat-fab=""
      >
        <Sparkles className="h-5 w-5 text-primary" />
      </Button>
    </div>
  )
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
  const isDesktopRail = useMediaQuery('(min-width: 1024px)')
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

        {isDesktopRail && resolvedProductId ? (
          <div
            className={cn(
              'flex min-h-0 flex-col border-t border-border/60 pt-2',
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
      isDesktopRail,
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
        mobileRailMode="overlay"
        rightRailPurpose="store-product"
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        rightRail={rightRail}
        railWidth={360}
      >
        <DavinciCenterPane contentClassName="space-y-6">{children}</DavinciCenterPane>
      </RingRightRailLayout>

      {resolvedProductId ? (
        <>
          <ProductAgentFloatingChatButton />
          <ProductAgentChatShell locale={locale} />
        </>
      ) : null}
    </ProductAgentChatProvider>
  )
}
