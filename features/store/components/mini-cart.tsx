'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import { useOptionalStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'

export function MiniCart({ locale }: { locale: Locale }) {
  const store = useOptionalStore()
  const currencyContext = useOptionalCurrency()
  const tCommon = useTranslations('common')
  const tStore = useTranslations('modules.store')
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // Currency formatting
  const formatPrice = currencyContext?.formatPrice || ((price: number) => `${price.toFixed(2)} ₴`)
  const convertPrice = currencyContext?.convertPrice || ((price: number) => price)
  const selectedCurrency = currencyContext?.currency || 'UAH'
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    let hoverWithin = false
    const onEnter = () => { hoverWithin = true; setOpen(true) }
    const onLeave = (e: MouseEvent) => {
      // Delay close to allow moving into overlay
      hoverWithin = false
      setTimeout(() => { if (!hoverWithin) setOpen(false) }, 200)
    }
    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    return () => {
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  if (!store) {
    return (
      <div className="relative" ref={containerRef}>
        <Link href={ROUTES.CART(locale)} className="relative inline-flex items-center" title={tStore('cart.title')}>
          <ShoppingCart className="h-5 w-5" />
        </Link>
      </div>
    )
  }
  const { cartItems, totalItems, totalPriceByCurrency, removeFromCart } = store

  return (
    <div className="relative" ref={containerRef}>
      <button className="relative inline-flex items-center hover:bg-accent/50 rounded p-1 transition-colors" onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)} aria-expanded={open} title={tStore('cart.title')}>
        <ShoppingCart className="h-5 w-5" />
        {mounted && totalItems > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {totalItems}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-0 top-[140px] w-[280px] bottom-[80px] bg-popover/95 backdrop-blur-sm border-r border-l border-border z-40 overflow-y-auto" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-semibold">{tStore('cart.title')}</span>
              <Badge variant="secondary">{totalItems} items</Badge>
            </div>
            {cartItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {tStore('cart.empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map(i => (
                  <div key={i.product.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{i.product.name}</div>
                      <div className="text-xs text-muted-foreground">Quantity: {i.quantity}</div>
                    </div>
                    <button
                      className="text-destructive hover:text-destructive/80 text-sm underline ml-2"
                      onClick={() => removeFromCart(i.product.id)}
                    >
                      {tCommon('actions.remove')}
                    </button>
                  </div>
                ))}
                <div className="border-t pt-3 mt-4">
                  <div className="text-sm font-medium mb-3">
                    {tStore('cart.total')}: {formatPrice(store.cartItems.reduce((sum, item) => {
                      const priceUAH = item.finalPrice || parseFloat(item.product.price)
                      const convertedPrice = convertPrice(priceUAH)
                      return sum + (convertedPrice * item.quantity)
                    }, 0))}
                  </div>
                  <div className="flex gap-3">
                    <Link
                      className="flex-1 text-center py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                      href={ROUTES.CART(locale)}
                      onClick={() => setOpen(false)}
                    >
                      {tStore('cart.title')}
                    </Link>
                    <Link
                      className="flex-1 text-center py-2 px-4 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm font-medium"
                      href={ROUTES.CHECKOUT(locale)}
                      onClick={() => setOpen(false)}
                    >
                      {tStore('checkout.title')}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


