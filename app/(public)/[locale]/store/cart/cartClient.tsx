'use client'

/**
 * Badass Cart Page
 * 
 * LAYOUT:
 * - Mobile: Single column, product cards stacked
 * - Desktop: 2-column grid (products | sticky summary sidebar)
 * 
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
 */

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import type { Locale } from '@/i18n-config'
import { useTranslations } from 'next-intl'
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function CartClient({ locale }: { locale: Locale }) {
  const { cartItems, removeFromCart, updateQuantity, clearCart, totalPriceByCurrency, totalItems } = useStore()
  const currencyContext = useOptionalCurrency()
  const [clearing, setClearing] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  const tCart = useTranslations('modules.store.cart')
  const tProduct = useTranslations('modules.store.product')
  const tCommon = useTranslations('common.actions')

  const handleRemoveItem = async (productId: string) => {
    setRemovingId(productId)
    await new Promise(resolve => setTimeout(resolve, 300)) // Animation delay
    removeFromCart(productId)
    setRemovingId(null)
  }

  const handleClearCart = async () => {
    setClearing(true)
    await new Promise(resolve => setTimeout(resolve, 400))
    clearCart()
    setClearing(false)
    setShowClearModal(false)
  }

  // Calculate totals (converted to selected currency)
  const cartTotal = cartItems.reduce((sum, item) => {
    const priceUAH = item.finalPrice || parseFloat(item.product.price)
    const convertedPrice = currencyContext?.convertPrice(priceUAH) || priceUAH
    return sum + (convertedPrice * item.quantity)
  }, 0)
  
  // Get selected currency and formatting functions
  const selectedCurrency = currencyContext?.currency || 'UAH'
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{tCart('title')}</h1>
                {mounted && cartItems.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {totalItems} {totalItems === 1 ? tCart('item') : tCart('items')}
                  </p>
                )}
              </div>
            </div>
            
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

      {/* Empty State */}
      {cartItems.length === 0 ? (
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="h-32 w-32 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="text-2xl font-bold mb-3">{tCart('empty')}</h2>
            <p className="text-muted-foreground mb-8">
              {tCart('emptyDescription')}
            </p>
            <Link href={ROUTES.STORE(locale)}>
              <Button size="lg" className="gap-2">
                <ShoppingCart className="h-5 w-5" />
                {tProduct('backToStore')}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8 pb-32 lg:pb-8">
          {/* Product List */}
          <div className="space-y-4">
              {cartItems.map((item) => {
                // Convert prices to selected currency
                const priceUAH = item.finalPrice || parseFloat(item.product.price)
                const basePriceUAH = parseFloat(item.product.price)
                const displayPrice = convertPrice(priceUAH)
                const displayBasePrice = convertPrice(basePriceUAH)
                const itemTotal = displayPrice * item.quantity
                const hasVariants = item.selectedVariants && Object.keys(item.selectedVariants).length > 0
                const hasPriceModifier = item.finalPrice && item.finalPrice !== parseFloat(item.product.price)
                const isRemoving = removingId === item.product.id

                return (
                  <div
                    key={item.product.id}
                    className={cn(
                      "bg-card border rounded-xl p-6 transition-all duration-300",
                      isRemoving && "opacity-0 scale-95"
                    )}
                  >
                    <div className="flex gap-6">
                      {/* Product Image */}
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
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold mb-1 leading-tight break-words">
                              {item.product.name}
                            </h3>
                            {item.product.category && (
                              <p className="text-sm text-muted-foreground">
                                {item.product.category}
                              </p>
                            )}
                          </div>
                          
                          {/* Remove Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.product.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Variant Badges */}
                        {hasVariants && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(item.selectedVariants).map(([name, value]) => (
                              <span
                                key={name}
                                className="inline-flex items-center px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium"
                              >
                                {name}: <span className="ml-1 text-primary font-semibold">{value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Price Breakdown */}
                        <div className="space-y-2 mb-4">
                          {hasPriceModifier ? (
                            <>
                              <div className="text-sm text-muted-foreground">
                                {tCart('basePrice')}: <span className="line-through">{formatPrice(displayBasePrice)}</span>
                              </div>
                              <div className="text-sm font-semibold text-primary">
                                {tCart('withOptions')}: {formatPrice(displayPrice)}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-semibold">
                              {formatPrice(displayPrice)}
                            </div>
                          )}
                        </div>

                        {/* Quantity Controls + Item Total */}
                        <div className="flex items-center justify-between">
                          {/* Quantity Stepper */}
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

                          {/* Item Total */}
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground mb-1">{tCart('itemTotal')}</div>
                            <div className="text-xl font-bold">
                              {formatPrice(itemTotal)}
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

      {/* Clear Cart Confirmation Modal */}
      {showClearModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200"
            onClick={() => setShowClearModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div 
              className="w-full max-w-md bg-popover rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
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
    </div>
  )
}
