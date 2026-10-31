'use client'

/**
 * CART PAGE WRAPPER - Ring Platform v2.0 (wired to ring-config SSOT)
 *
 * Thin modern wrapper using RingRightRailLayout + DavinciCenterPane.
 * Cart totals come from quoteFromSettings (product promotions + promo codes).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useStore } from '@/features/store/context'
import {
  useStorePaymentMethods,
  MAIN_CURRENCY,
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
  CheckCircle,
  Trash2,
} from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { findStorePromoCode } from '@/features/store/types/promotions'
import { DEFAULT_STORE_SETTINGS, quoteFromSettings } from '@/features/store/types/store-settings'
import { cartLineVendorId } from '@/features/store/lib/cart-pricing'

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
  const { cartItems, clearCart, appliedPromoCode, setAppliedPromoCode, storefrontSettings } = useStore()
  // Currency SSOT — convertPrice/formatPrice are plain functions from context (safe in useMemo)
  const { currency, convertPrice, formatPrice, mainCurrency } = useStorePaymentMethods()

  // Translation dictionary hook for cart
  const t = useTranslations('modules.store.cart')
  const tCommon = useTranslations('common.actions')

  const formatCartPrice = useCallback(
    (amountMain: number) =>
      formatPrice(convertPrice(amountMain, mainCurrency, currency), currency),
    [formatPrice, convertPrice, mainCurrency, currency],
  )

  // Track mount state for conditional client rendering (to avoid hydration mismatches for toggles)
  const [mounted, setMounted] = useState(false)
  // Whether floating sidebar is open (mobile/toggle)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoRejected, setPromoRejected] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Set mounted true after first render; used for mobile-component toggling
  useEffect(() => setMounted(true), [])

  // Until client storage hydrates, treat cart as empty so SSR HTML matches first paint.
  const visibleCartItems = mounted ? cartItems : []
  const totalItems = visibleCartItems.length
  const settings = storefrontSettings ?? DEFAULT_STORE_SETTINGS
  const quote = useMemo(
    () =>
      quoteFromSettings({
        lines: visibleCartItems.map((item) => {
          const raw = item.finalPrice != null ? item.finalPrice : parseFloat(item.product.price || '0')
          const from = resolveStorePriceCurrency(item.product.currency || MAIN_CURRENCY)
          return {
            unitPrice: convertPrice(raw, from, mainCurrency),
            quantity: item.quantity,
            promotions: item.product.promotions,
          vendorEntityId: cartLineVendorId(item.product),
          }
        }),
        settings,
        promoCode: appliedPromoCode,
        method: 'pickup',
      }),
    [visibleCartItems, settings, appliedPromoCode, convertPrice, mainCurrency],
  )
  const cartTotal = Math.max(0, quote.subtotal - quote.discount)

  const handleApplyPromo = useCallback(() => {
    const match = findStorePromoCode(settings.promotions.promoCodes, promoCode)
    if (!match) {
      setPromoRejected(true)
      return
    }
    setPromoRejected(false)
    setAppliedPromoCode(match.code)
    setPromoCode('')
  }, [promoCode, setAppliedPromoCode, settings.promotions.promoCodes])

  const handleClearCart = useCallback(() => {
    setClearing(true)
    clearCart()
    setClearing(false)
    setShowClearModal(false)
  }, [clearCart])

  const closeRail = useCallback(() => setRightSidebarOpen(false), [])

  function SideRail() {
    return (
      <CartSidebarContent
        locale={locale}
        cartItems={visibleCartItems}
        totalPrice={cartTotal}
        merchandiseTotal={quote.subtotal}
        discount={quote.discount}
        totalItems={totalItems}
        formatPrice={formatCartPrice}
        appliedPromo={appliedPromoCode}
        promoCode={promoCode}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={() => setAppliedPromoCode(null)}
        onPromoCodeChange={setPromoCode}
        onNavigate={closeRail}
      />
    )
  }

  const layout = (
    <RingRightRailLayout
      rightRailPurpose="cart"
      showRightRail={false}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
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
          <div className="mb-2 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {t('title', { defaultValue: 'Cart' })}
            </h1>
            {totalItems > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearModal(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('clear')}
              </Button>
            ) : null}
          </div>
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
                    <span>{formatCartPrice(quote.subtotal)}</span>
                  </div>
                  {quote.discount > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span>{t('discount', { defaultValue: 'Discount' })}</span>
                      <span>-{formatCartPrice(quote.discount)}</span>
                    </div>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {t('shippingCalculatedAtCheckout')}
                  </p>
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
                  {appliedPromoCode ? (
                    <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/40">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{appliedPromoCode}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAppliedPromoCode(null)}
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
                        >
                          {t('apply')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {promoRejected
                          ? t('invalidPromo', { defaultValue: 'That code is not active.' })
                          : t('tryCode', { defaultValue: 'Try code: WELCOME10 for $5 off' })}
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

  return (
    <>
      {layout}
      {showClearModal ? (
        <>
          <div
            className="fixed inset-0 z-50 animate-in fade-in-0 bg-black/60 backdrop-blur-sm duration-200"
            onClick={() => setShowClearModal(false)}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
            <div
              className="pointer-events-auto w-full max-w-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-popover shadow-2xl duration-300"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-border bg-gradient-to-br from-destructive/20 via-destructive/10 to-transparent p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
                    <Trash2 className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('clearConfirmTitle')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('clearConfirmDescription').replace('{count}', totalItems.toString())}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-6">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleClearCart}
                  disabled={clearing}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {clearing ? t('clearing') : t('yesClearCart')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="w-full"
                >
                  {tCommon('cancel')}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}