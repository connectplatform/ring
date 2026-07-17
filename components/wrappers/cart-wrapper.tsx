'use client'

/**
 * CART PAGE WRAPPER - Ring Platform v2.0 (wired to ring-config SSOT)
 *
 * Thin modern wrapper using RingRightRailLayout + DavinciCenterPane.
 * Handles wire-up to ring-config APIs for pricing, currency, and formatting.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useStore } from '@/features/store/context'
import {
  useStoreCurrency,
  DEFAULT_CURRENCY,
  resolveStorePriceCurrency,
} from '@/features/store/currency-context'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import CartSidebarContent from '@/components/layout/rails/cart-rail'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  ShoppingCart,
  CreditCard,
  ArrowLeft,
  Tag,
  Bookmark,
  Percent,
  CheckCircle,
} from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import type { StoreCurrency } from '@/features/store/currency-context'
import { applyProductPromotionToLine } from '@/features/store/types/promotions'

/**
 * Computes cart total with correct currency conversion using SSOT.
 * Applies per-product promotions (BOGO / % / amount) after conversion.
 * convertPrice must be the context function — never a Hook wrapper.
 */
function useCartTotal(
  cartItems: any[],
  currency: StoreCurrency,
  convertPrice: (n: number, f: StoreCurrency, t: StoreCurrency) => number,
): number {
  return useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const raw = item.finalPrice != null ? item.finalPrice : parseFloat(item.product.price)
      const from = resolveStorePriceCurrency(item.product.currency || DEFAULT_CURRENCY)
      const unit = convertPrice(raw, from, currency)
      const { lineTotal } = applyProductPromotionToLine(
        unit,
        item.quantity,
        item.product.promotions,
      )
      return sum + lineTotal
    }, 0)
  }, [cartItems, convertPrice, currency])
}

// ---- Main Wrapper ----

// Props: expects children and a locale string
interface CartWrapperProps {
  children: React.ReactNode
  locale: Locale
}

export default function CartWrapper({ children, locale }: CartWrapperProps) {
  // Router for imperatively pushing (navigation)
  const router = useRouter()
  // Get cart items from global store context
  const { cartItems } = useStore()
  // Currency SSOT — convertPrice/formatPrice are plain functions from context (safe in useMemo)
  const { currency, convertPrice, formatPrice } = useStoreCurrency()

  // Translation dictionary hook for cart
  const t = useTranslations('modules.store.cart')

  const formatCartPrice = useCallback(
    (amount: number) => formatPrice(amount, currency),
    [formatPrice, currency],
  )

  // Track mount state for conditional client rendering (to avoid hydration mismatches for toggles)
  const [mounted, setMounted] = useState(false)
  // Whether floating sidebar is open (mobile/toggle)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)

  // Set mounted true after first render; used for mobile-component toggling
  useEffect(() => setMounted(true), [])

  // Until client storage hydrates, treat cart as empty so SSR HTML matches first paint.
  const visibleCartItems = mounted ? cartItems : []
  const totalItems = visibleCartItems.length
  const cartTotal = useCartTotal(visibleCartItems, currency, convertPrice)

  const handleApplyPromo = useCallback(() => {
    if (promoCode.trim().toLowerCase() === 'welcome10') {
      setAppliedPromo('WELCOME10')
      setPromoCode('')
    }
  }, [promoCode])

  // Closes the side rail by setting state
  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  // The content for the Cart sidebar (rail)
  function SideRail() {
    return (
      <CartSidebarContent
        locale={locale}
        cartItems={visibleCartItems}
        totalPrice={cartTotal}
        totalItems={totalItems}
        formatPrice={formatCartPrice}
        appliedPromo={appliedPromo}
        promoCode={promoCode}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={() => setAppliedPromo(null)}
        onPromoCodeChange={setPromoCode}
        onNavigate={closeRail}
      />
    )
  }

  // ---- Main rendered layout ----
  return (
    <RingRightRailLayout
      rightRailPurpose="cart"
      rightRailContent={[
        {
          id: 'cart-sidebar',
          blockType: 'cart-sidebar',
          i18nKey: 'modules.store.cart.sidebar',
          params: {
            locale,
            cartItems: visibleCartItems,
            totalPrice: cartTotal,
            totalItems: totalItems,
            formatPrice: formatCartPrice,
            onNavigate: closeRail
          }
        }
      ]}
      showRightRail={false} // Sidebar only shows when opened by user
      railWidth={380}
      contentClassName="pb-[calc(11rem+env(safe-area-inset-bottom,0px))] lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane>
        {/* Header Section: Back link and Cart title (single title — list has no duplicate). */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            {/* Link back to store home */}
            <Link
              href={`/${locale}/store`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back', { defaultValue: 'Back to Store' })}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('title', { defaultValue: 'Cart' })}
          </h1>
        </div>
        {/* Main grid: products + order summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div>
            {/* Slot for main cart children (product list) */}
            {children}
          </div>
          {/* Desktop sidebar: mirrors greenfood CartWrapper RightSidebarContent (items only) */}
          {totalItems > 0 && (
            <div className="hidden lg:block">
              <div className="sticky top-8 space-y-8">
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    {t('orderSummary', { defaultValue: 'Order Summary' })}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t('orderSummaryDescription', {
                      defaultValue: 'Review your order summary before proceeding to checkout.',
                    })}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>
                      {t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems}{' '}
                      {totalItems === 1
                        ? t('item', { defaultValue: 'item' })
                        : t('items', { defaultValue: 'items' })})
                    </span>
                    <span>{formatCartPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
                    <span className="text-green-600">
                      {t('free', { defaultValue: 'Free' })}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>{t('total', { defaultValue: 'Total' })}</span>
                    <span>{formatCartPrice(cartTotal)}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/${locale}/store/checkout`)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('proceedToCheckout', { defaultValue: 'Proceed to Checkout' })}
                  </Button>
                </div>

                {/* Promo Codes */}
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    {t('promoCodes', { defaultValue: 'Promo Codes' })}
                  </h2>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-2 rounded-lg border border-green-200/80 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">{appliedPromo}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAppliedPromo(null)}
                      >
                        {t('remove', { defaultValue: 'Remove' })}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('enterPromoCode', { defaultValue: 'Enter promo code' })}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyPromo()
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={handleApplyPromo}
                          disabled={!promoCode.trim()}
                          aria-label={t('promoCodes', { defaultValue: 'Promo Codes' })}
                        >
                          <Percent className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('tryCode', { defaultValue: 'Try code: WELCOME10 for $5 off' })}
                      </p>
                    </>
                  )}
                </div>

                {/* Saved for Later */}
                <div className="border-t border-border/60 pt-4 space-y-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    {t('savedForLater', { defaultValue: 'Saved for Later' })}
                  </h2>
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('noSavedItems', { defaultValue: 'No items saved for later' })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DavinciCenterPane>

      {/* MOBILE: Floating cart rail toggle; only mounted on client and when items exist */}
      {mounted && totalItems > 0 && (
        <FloatingSidebarToggle
          isOpen={rightSidebarOpen}
          onToggle={setRightSidebarOpen}
          mobileWidth="90%"
          tabletWidth="380px"
        >
          <SideRail />
        </FloatingSidebarToggle>
      )}

      {/* MOBILE: Persistent bottom bar above mobile nav (bottom-nav ~4.25rem + safe area) */}
      {mounted && totalItems > 0 && (
        <div
          className="lg:hidden fixed inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm"
          style={{
            bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="container mx-auto px-4 py-3 mb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Mobile Cart summary (subtotal and total) */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems}{' '}
                    {totalItems === 1
                      ? t('item', { defaultValue: 'item' })
                      : t('items', { defaultValue: 'items' })})
                  </span>
                  <span className="font-medium">{formatCartPrice(cartTotal)}</span>
                </div>
                {/* Total row with larger type */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-semibold">
                    {t('total', { defaultValue: 'Total' })}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {formatCartPrice(cartTotal)}
                  </span>
                </div>
              </div>
              {/* Proceed to checkout - mobile CTA */}
              <Button
                onClick={() => router.push(`/${locale}/store/checkout`)}
                size="lg"
                className="px-6 py-3 font-semibold shadow-lg"
              >
                {t('proceedToCheckout', { defaultValue: 'Checkout' })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </RingRightRailLayout>
  )
}

/* 
==== TODOS AND STUBS ====

- TODO: Modernize state/transition management with React 19/Next 16 server components and hooks, if/when those are supported (e.g., switch useState/useEffect for mount-detection to useOptimistic or server-aware lifecycle).
- TODO: Replace `useEffect(() => setMounted(true), [])` and conditional `mounted` renderings with use client directive (where possible) as client-side APIs in Next 16/React 19 stabilize.
- TODO: Refactor currency/format helpers to use a single source of truth from context or server action, not redundant hooks.
- TODO: Replace asserts on `as StoreCurrency` for cartTotal/formatters with more deliberate typing, or stricter typing in context hooks for improved safety.
- STUB: Shipping is hardcoded as 'Free'; future enhancement would bring in a dynamic shipping API and fee estimation (step-by-step: (1) design API, (2) update cart summary, (3) conditional shipping block).
- TODO: Move all business logic (totalling, format, currency) into dedicated single-hook or backend utility for easier testability and SSR support.

*/