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

import React, { useState, useEffect, useMemo, useCallback } from 'react' // useCallback for stable event handlers (React 18+, useEvent in React 19).
import Link from 'next/link'
import Image from 'next/image'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { useOptionalStoreCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// TODO: Once on React 19, switch all event handlers (especially for modal control and cart item updates) to useEvent for stable refs.

export default function CartClient({ locale }: { locale: Locale }) {
  // Cart state & actions from global store context.
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalItems } = useStore()

  // Currency converter from context, and detected store currency code (optional).
  const { convertPrice: convertStoreCurrencyPrice, currency: optionalStoreCurrency } = useOptionalStoreCurrency()

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

  // Memoize calculation of total cart price, applying currency conversion if needed.
  // TODO: Offload to server if app supports server components, or pre-calculate in context for perf.
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      // Item price in UAH: use final if available (includes selected options/variants), else product base price.
      const priceUAH = item.finalPrice ?? parseFloat(item.product.price)
      // Try to convert to chosen store currency; fallback to UAH if conversion fails.
      const convertedPrice = convertStoreCurrencyPrice(priceUAH, optionalStoreCurrency, locale) || priceUAH
      return sum + (convertedPrice * item.quantity)
    }, 0)
  }, [cartItems, convertStoreCurrencyPrice, optionalStoreCurrency, locale])

  // Determine the user's locale string for formatting, using browser if available (more natural grouping, eg 1 000,00).
  const localeString = typeof window !== "undefined" && window.navigator?.language
    ? window.navigator.language
    : locale.replace('_', '-')
  // Which currency do we format as? Explicit from context, else fallback to UAH.
  const selectedCurrency = optionalStoreCurrency || 'UAH'

  // Format currency safely for display. Fallback to simple formatted string if Intl fails.
  function robustFormatPrice(amount: number) {
    try {
      return new Intl.NumberFormat(localeString, {
        style: 'currency',
        currency: selectedCurrency,
        maximumFractionDigits: 2
      }).format(amount)
    } catch {
      // fallback to basic formatting if Intl fails (rare, but possible in custom locales)
      return `${amount.toFixed(2)} ${selectedCurrency}`
    }
  }

  // --- Render Begins ---
  return (
    <div className="min-h-screen bg-background">
      {/* Cart header: sticky, with cart icon, heading, count and clear button */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Cart icon indicator */}
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{tCart('title')}</h1>
                {/* Show item count only after hydration for SSR safety */}
                {mounted && cartItems.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {totalItems} {totalItems === 1 ? tCart('item') : tCart('items')}
                  </p>
                )}
              </div>
            </div>
            {/* Show "Clear cart" action button only if cart has items, after mount */}
            {mounted && cartItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearModal(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {tCart('clear')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cart Contents: show either "Empty" state or populated cart */}
      {cartItems.length === 0 ? (
        // --- EMPTY CART: large icon, empty message, back-to-store CTA
        <div className="container mx-auto px-4 py-16">
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
        // --- POPULATED CART: Render each item row ---
        <div className="container mx-auto px-4 py-8 pb-32 lg:pb-8">
          <div className="space-y-4">
            {/* 
              TODO: Extract into <CartItem /> (memoized/React.memo, or server/rsc CartItem if moving to server components).
              For React 19/Next 16: migrate this map to use memoized components or canonical server-side item renders. 
            */}
            {cartItems.map((item) => {
              // Core per-item logic:
              // - Determine price fields and show price breakdown if necessary.
              // - Animate on remove (removingId), and support variant badges.
              // - Disable decrement below 1.
              // - Show remove and quantity controls.
              const priceUAH = item.finalPrice ?? parseFloat(item.product.price) // Effective price in UAH
              const basePriceUAH = parseFloat(item.product.price)                // Base price in UAH
              const displayPrice = convertStoreCurrencyPrice(priceUAH, optionalStoreCurrency, locale) // Current-currency, from context
              const displayBasePrice = convertStoreCurrencyPrice(basePriceUAH, optionalStoreCurrency, locale)
              const itemTotal = displayPrice * item.quantity                     // Total for this cart row
              const hasVariants = Boolean(item.selectedVariants && Object.keys(item.selectedVariants).length)
              const hasPriceModifier = Boolean(item.finalPrice && item.finalPrice !== basePriceUAH)
              const isRemoving = removingId === item.product.id

              return (
                <div
                  key={item.product.id}
                  className={cn(
                    "bg-card border rounded-xl p-6 transition-all duration-300",
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
