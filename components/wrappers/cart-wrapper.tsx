'use client'

/**
 * CART PAGE WRAPPER - Ring Platform v2.0 (wired to ring-config SSOT)
 *
 * Thin modern wrapper using RingRightRailLayout + DavinciCenterPane.
 * Handles wire-up to ring-config APIs for pricing, currency, and formatting.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useStore } from '@/features/store/context'
import {
  useStoreCurrency,
  useDisplayPrice,
} from '@/features/store/currency-context'
import { getDefaultStoreCurrencySymbol } from '@/lib/payments/payment.config'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import CartSidebarContent from '@/components/layout/rails/cart-rail'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ShoppingCart, CreditCard, ArrowLeft } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { StoreCurrency } from '@/features/store/types'

// ---- Currency helpers from SSOT ----

/**
 * Returns currency and formatting helpers from ring-config SSOT.
 */
function useCartCurrency() {
  // Get currency settings from store
  const { currency } = useStoreCurrency()
  return { currency }
}

/**
 * Memoized format price with current config currency.
 * // TODO: React 19 useCallback is stable, but could use use( )?  
 * Consider using useOptimistic or use to simplify, when stable.
 */
function useFormatCartPrice(currency: StoreCurrency) {
  // Memoize price formatter to currency
  return React.useCallback(
    (amount: number) => useDisplayPrice(amount),
    [currency]
  )
}

/**
 * Computes cart total with correct currency conversion using SSOT.
 */
function useCartTotal(
  cartItems: any[],
  currency: StoreCurrency,
  convertPrice: (n: number, f: StoreCurrency, t: StoreCurrency) => number,
): number {
  // Get the default currency for correct conversion
  const DEFAULT_CURRENCY = getDefaultStoreCurrencySymbol()
  return React.useMemo(() => {
    // Calculate total by summing each item's (converted) finalPrice * quantity
    return cartItems.reduce((sum, item) => {
      // Use finalPrice if set, else fallback to base product price
      const raw = item.finalPrice != null ? item.finalPrice : parseFloat(item.product.price)
      // Catalog prices are always in DEFAULT_CURRENCY, must convert to display currency
      const converted = convertPrice(raw, DEFAULT_CURRENCY, currency)
      return sum + converted * item.quantity
    }, 0)
    // NOTE: including DEFAULT_CURRENCY in deps for completeness, but string value rarely changes
  }, [cartItems, convertPrice, currency, DEFAULT_CURRENCY])
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
  // Current currency
  const { currency } = useCartCurrency()

  // Translation dictionary hook for cart
  const t = useTranslations('modules.store.cart')
  // Count number of items for summary/labels
  const totalItems = cartItems.length

  // TODO: The parameters to useCartTotal and formatCartPrice:
  // - Currently both `convertPrice` and `currency` are `currency` type. Should pass explicit conversion function for true SSOT compliance.
  // - Convert useCartTotal to use native server function if possible, using Next 16/React 19 hooks (if stable in this part of codebase).

  // Calculate cart total (in current currency)
  const cartTotal = useCartTotal(cartItems, currency, (amount: number) => parseFloat(useDisplayPrice(amount)))
  // Price formatting function (memoized to currency)
  const formatCartPrice = useFormatCartPrice(currency)

  // Track mount state for conditional client rendering (to avoid hydration mismatches for toggles)
  const [mounted, setMounted] = useState(false)
  // Whether floating sidebar is open (mobile/toggle)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  // Set mounted true after first render; used for mobile-component toggling
  useEffect(() => setMounted(true), [])
  // Effectively equivalent to useEffect once, React 19 could enable use( ) for client transitions

  // Closes the side rail by setting state
  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  // The content for the Cart sidebar (rail)
  function SideRail() {
    return (
      <CartSidebarContent
        locale={locale}
        cartItems={cartItems}
        totalPrice={cartTotal}
        totalItems={totalItems}
        formatPrice={formatCartPrice}
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
            cartItems,
            totalPrice: cartTotal,
            totalItems: totalItems,
            formatPrice: formatCartPrice,
            onNavigate: closeRail
          }
        }
      ]}
      showRightRail={false} // Sidebar only shows when opened by user
      railWidth={380}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane>
        {/* Header Section: Back link and Cart title */}
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
          {/* Order summary for desktop (sticks to top) */}
          {cartItems.length > 0 && (
            <div className="hidden lg:block">
              <div className="sticky top-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      {t('orderSummary', { defaultValue: 'Order Summary' })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Subtotal for order */}
                    <div className="flex justify-between text-sm">
                      <span>
                        {t('subtotal', { defaultValue: 'Subtotal' })} ({totalItems}{' '}
                        {totalItems === 1
                          ? t('item', { defaultValue: 'item' })
                          : t('items', { defaultValue: 'items' })})
                      </span>
                      <span>{formatCartPrice(cartTotal)}</span>
                    </div>
                    {/* Shipping row - currently always 'Free' */}
                    <div className="flex justify-between text-sm">
                      <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
                      <span className="text-green-600">
                        {t('free', { defaultValue: 'Free' })}
                      </span>
                    </div>
                    <Separator />
                    {/* Total row */}
                    <div className="flex justify-between font-medium">
                      <span>{t('total', { defaultValue: 'Total' })}</span>
                      <span>{formatCartPrice(cartTotal)}</span>
                    </div>
                    {/* Checkout button navigates to checkout page */}
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/${locale}/store/checkout`)}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {t('proceedToCheckout', { defaultValue: 'Proceed to Checkout' })}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </DavinciCenterPane>

      {/* MOBILE: Floating cart rail toggle; only mounted on client and when items exist */}
      {mounted && cartItems.length > 0 && (
        <FloatingSidebarToggle
          isOpen={rightSidebarOpen}
          onToggle={setRightSidebarOpen}
          mobileWidth="90%"
          tabletWidth="380px"
        >
          <SideRail />
        </FloatingSidebarToggle>
      )}

      {/* MOBILE: Persistent bottom bar with subtotal + checkout button; only on client + with items */}
      {mounted && cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="container mx-auto px-4 py-4">
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