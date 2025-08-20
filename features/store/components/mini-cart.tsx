'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useOptionalStore } from '@/features/store/context'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'

export function MiniCart({ locale }: { locale: Locale }) {
  const store = useOptionalStore()
  const tCommon = useTranslations('common')
  const tStore = useTranslations('modules.store')
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  
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
        <Link href={ROUTES.CART(locale)} className="inline-flex items-center gap-1" title={tStore('cart.title')}>
          <ShoppingCart className="h-5 w-5" />
          <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">0</span>
        </Link>
      </div>
    )
  }
  const { cartItems, totalItems, totalPriceByCurrency, removeFromCart } = store

  return (
    <div className="relative" ref={containerRef}>
      <button className="inline-flex items-center gap-1" onMouseEnter={() => setOpen(true)} onFocus={() => setOpen(true)} aria-expanded={open} title={tStore('cart.title')}>
        <ShoppingCart className="h-5 w-5" />
        <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">{mounted ? totalItems : 0}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border rounded shadow p-3 z-50" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          {cartItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">{tStore('cart.empty')}</div>
          ) : (
            <div className="space-y-2">
              {cartItems.slice(0, 5).map(i => (
                <div key={i.product.id} className="flex items-center justify-between text-sm">
                  <div className="truncate mr-2">{i.product.name} × {i.quantity}</div>
                  <button className="underline" onClick={() => removeFromCart(i.product.id)}>{tCommon('actions.remove')}</button>
                </div>
              ))}
              {cartItems.length > 5 && (
                <div className="text-xs text-muted-foreground">+{cartItems.length - 5} more</div>
              )}
              <div className="text-sm">{tStore('cart.total')}: {totalPriceByCurrency.DAAR || 0} DAAR{(totalPriceByCurrency.DAAR && totalPriceByCurrency.DAARION) ? ' + ' : ''}{totalPriceByCurrency.DAARION || 0} DAARION</div>
              <div className="flex gap-3 text-sm">
                <Link className="underline" href={ROUTES.CART(locale)} onClick={() => setOpen(false)}>{tStore('cart.title')}</Link>
                <Link className="underline" href={ROUTES.CHECKOUT(locale)} onClick={() => setOpen(false)}>{tStore('checkout.title')}</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


