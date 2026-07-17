'use client'

/**
 * Cart Client Page
 * 
 * LAYOUT:
 * - Mobile: Single column, product cards stacked
 * - Desktop: 2-column grid (products | sticky summary sidebar)
 * FEATURES:
 * - Product images with fallback
 * - Variant badges (Phase 2 complete)
 * - Price breakdown (base → with options)
 * - Quantity stepper controls
 * - Remove item with animation
 * - Empty state with icon + CTA
 * - Sticky order summary (desktop)
 * - Currency breakdown
 * - Clear cart confirmation modal
 * - Full internationalization
 * 
 * NOTE:
 * - Uses client-side store context for cart state.
 * - React 19/Next 16 optimizations available: see TODOs.
 */

// TODO: Migrate to React 19 useOptimistic/useFormStatus for improved async UI transitions.
// TODO: Replace anonymous event handlers with useEvent (React 19) for stable event references.
// TODO: Refactor CartItem row with React.memo or move to a pure server component when App Router migration completes.
// TODO: Abstract modals and buttons for accessibility and reduced re-renders.
// TODO: Use Suspense boundaries for currency and locale loading for better UX in Next.js 16.

import React, { useState, useEffect, useCallback } from 'react' // useCallback for stable event handlers (React 18+, useEvent in React 19).
import Link from 'next/link'
import Image from 'next/image'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import {
  useStoreCurrency,
  resolveStorePriceCurrency,
  DEFAULT_CURRENCY,
} from '@/features/store/currency-context'
import { applyProductPromotionToLine } from '@/features/store/types/promotions'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// TODO: Once on React 19, switch all event handlers (especially for modal control and cart item updates) to useEvent for stable refs.

export default function CartClient({ locale }: { locale: Locale }) {
  // Cart state & actions from global store context.
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems } = useStore()

  // Currency converter from context (amount, from, to) — never pass locale as a currency code.
  const {
    convertPrice: convertStoreCurrencyPrice,
    currency: displayCurrency,
    formatPrice,
  } = useStoreCurrency()

  // UI states for confirmation modals, animations, mount guard.
  const [clearing, setClearing] = useState(false)                  // Used to show spinner and disable modal UI when clearing cart.
  const [showClearModal, setShowClearModal] = useState(false)      // Controls "Are you sure?" clear cart modal display.
  const [removingId, setRemovingId] = useState<string | null>(null) // Used for fade-out animation on item removal.
  const [mounted, setMounted] = useState(false)                    // Set true after hydration to prevent SSR mismatch.

  // On client hydration, set mounted flag. Prevents hydration mismatch on cart item count etc.
  useEffect(() => {
    setMounted(true)
  }, [])

  // Internationalization hooks, localized XI18N keys
  const tCart = useTranslations('modules.store.cart')
  const tProduct = useTranslations('modules.store.product')
  const tCommon = useTranslations('common.actions')

  // SSR + first client paint must match: defer localStorage cart until after mount.
  const visibleItems = mounted ? cartItems : []
  const visibleTotalItems = mounted ? totalItems : 0

  // Remove one item from cart, triggering fade-out. Waits for animation before state update.
  // TODO: use useOptimistic (React 19) for less delay and more robust optimistic UI.
  const handleRemoveItem = useCallback(async (productId: string) => {
    setRemovingId(productId)
    await new Promise(resolve => setTimeout(resolve, 300)) // delay for animation
    removeFromCart(productId)
    setRemovingId(null)
  }, [removeFromCart])

  // Clear all cart items. Shows spinner while clearing. Confirmation modal closes after.
  // TODO: use useOptimistic for smoother UX when clearing lots of items.
  const handleClearCart = useCallback(async () => {
    setClearing(true)
    await new Promise(resolve => setTimeout(resolve, 400)) // simulate clearing delay for UX
    clearCart()
    setClearing(false)
    setShowClearModal(false)
  }, [clearCart])

  function robustFormatPrice(amount: number) {
    return formatPrice(amount, displayCurrency)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: item count + clear — title lives in CartWrapper (DaVinci flush, no duplicate). */}
      {visibleItems.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {visibleTotalItems} {visibleTotalItems === 1 ? tCart('item') : tCart('items')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearModal(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {tCart('clear')}
          </Button>
        </div>
      )}

      {/* Cart Contents: show either "Empty" state or populated cart */}
      {visibleItems.length === 0 ? (
        // --- EMPTY CART: large icon, empty message, back-to-store CTA
        <div className="py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="h-32 w-32 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-bold mb-3">{tCart('empty')}</h2>
            <p className="text-muted-foreground mb-8">
              {tCart('emptyDescription')}
            </p>
            {/* Button: Go back to store */}
            <Link href={ROUTES.STORE(locale)}>
              <Button size="lg" className="gap-2">
                <ShoppingCart className="h-5 w-5" />
                {tProduct('backToStore')}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        // --- POPULATED CART: Render each item row (DaVinci: no card bg) ---
        <div className="pb-28 lg:pb-0">
          <div className="space-y-3">
            {/* 
              TODO: Extract into <CartItem /> (memoized/React.memo, or server/rsc CartItem if moving to server components).
              For React 19/Next 16: migrate this map to use memoized components or canonical server-side item renders. 
            */}
            {visibleItems.map((item) => {
              // Core per-item logic:
              // - Determine price fields and show price breakdown if necessary.
              // - Animate on remove (removingId), and support variant badges.
              // - Disable decrement below 1.
              // - Show remove and quantity controls.
              const rawPrice = item.finalPrice ?? parseFloat(item.product.price)
              const basePrice = parseFloat(item.product.price)
              const from = resolveStorePriceCurrency(item.product.currency || DEFAULT_CURRENCY)
              const displayPrice = convertStoreCurrencyPrice(rawPrice, from, displayCurrency)
              const displayBasePrice = convertStoreCurrencyPrice(basePrice, from, displayCurrency)
              const { lineTotal: itemTotal, applied: appliedPromo } = applyProductPromotionToLine(
                displayPrice,
                item.quantity,
                item.product.promotions,
              )
              const hasVariants = Boolean(item.selectedVariants && Object.keys(item.selectedVariants).length)
              const hasPriceModifier = Boolean(item.finalPrice && item.finalPrice !== basePrice)
              const isRemoving = removingId === item.product.id

              return (
                <div
                  key={item.product.id}
                  className={cn(
                    "border-b border-border/60 py-4 transition-all duration-300 last:border-b-0",
                    isRemoving && "opacity-0 scale-95" // Animates out on remove
                  )}
                >
                  <div className="flex gap-6">
                    {/* --- LEFT: Image Thumbnail --- */}
                    <div className="flex-shrink-0">
                      <div className="relative h-32 w-32 rounded-lg overflow-hidden bg-muted">
                        {item.product.images && item.product.images.length > 0 ? (
                          <Image
                            src={item.product.images[0]}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="128px"
                          />
                        ) : (
                          // Fallback: bag icon if no product image exists
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* --- RIGHT: Details & Controls --- */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          {/* Product Name */}
                          <h3 className="text-lg font-semibold mb-1 leading-tight break-words">
                            {item.product.name}
                          </h3>
                          {/* Optional: Category, if provided */}
                          {item.product.category && (
                            <p className="text-sm text-muted-foreground">
                              {item.product.category}
                            </p>
                          )}
                        </div>
                        {/* Remove Button: animate fade, disables row during fade */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Variant badges: color/size/option, if any */}
                      {hasVariants && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Object.entries(item.selectedVariants!).map(([name, value]) => (
                            <span
                              key={name}
                              className="inline-flex items-center px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium"
                            >
                              {name}: <span className="ml-1 text-primary font-semibold">{value}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Price breakdown: if price differs from base due to option/variant, show both */}
                      <div className="space-y-2 mb-4">
                        {hasPriceModifier ? (
                          <>
                            <div className="text-sm text-muted-foreground">
                              {tCart('basePrice')}: <span className="line-through">{robustFormatPrice(displayBasePrice)}</span>
                            </div>
                            <div className="text-sm font-semibold text-primary">
                              {tCart('withOptions')}: {robustFormatPrice(displayPrice)}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-semibold">
                            {robustFormatPrice(displayPrice)}
                          </div>
                        )}
                      </div>

                      {/* Quantity controls + per-item total */}
                      <div className="flex items-center justify-between">
                        {/* Quantity steppers, min=1 */}
                        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="h-8 w-8 p-0 hover:bg-background"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-semibold text-lg">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="h-8 w-8 p-0 hover:bg-background"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Per-item total, formatted */}
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground mb-1">{tCart('itemTotal')}</div>
                          <div className="text-xl font-bold">
                            {robustFormatPrice(itemTotal)}
                          </div>
                          {appliedPromo?.label ? (
                            <p className="text-xs text-green-600 mt-1">{appliedPromo.label}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CLEAR CART MODAL: open when user attempts to clear all, disables during spinner */}
      {showClearModal && (
        <>
          {/* Modal backdrop covers the window; clicking closes modal */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200"
            onClick={() => setShowClearModal(false)}
          />
          {/* Modal dialog container: centered and on top */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div 
              className="w-full max-w-md bg-popover rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Confirm clear cart header */}
              <div className="p-6 border-b border-border bg-gradient-to-br from-destructive/20 via-destructive/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{tCart('clearConfirmTitle')}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {tCart('clearConfirmDescription').replace('{count}', totalItems.toString())}
                    </p>
                  </div>
                </div>
              </div>
              {/* Modal action buttons: really clear (primary, destructive)/cancel */}
              <div className="p-6 space-y-3">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleClearCart}
                  disabled={clearing}
                  className="w-full"
                >
                  {clearing ? (
                    <>
                      {/* Spinner visual feedback */}
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {tCart('clearing')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {tCart('yesClearCart')}
                    </>
                  )}
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
      )}

      {/* 
        TODO: Add a right-side sticky Order Summary as a server component once on Next.js 16/App Router.
        // STUB: OrderSummaryServerComponent should be imported and used here. 
        // Next Steps: 
        //   1. Create /components/store/OrderSummaryServer.tsx as an RSC. 
        //   2. Pass cartItems & locale as props for accurate server-side price calc.
        //   3. Insert <OrderSummaryServerComponent cartItems={cartItems} locale={locale}/> here. 
      */}
    </div>
  )
}
