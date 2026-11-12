'use client'

/**
 * Cart lines. Quantity lives in the store context, not a form, so useFormStatus
 * does not apply. Removal uses useOptimistic inside startTransition. The
 * shippable clamp reads the latest cart through useEffectEvent.
 * React 19 has no useEvent; useEffectEvent is the stable 19.2 hook.
 */

import React, { memo, useEffect, useEffectEvent, useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import {
  useStorePaymentMethods,
  resolveStorePriceCurrency,
  MAIN_CURRENCY,
  type StorePaymentMethods,
} from '@/features/store/currency-context'
import { applyProductPromotionToLine } from '@/features/store/types/promotions'
import type { CartItem } from '@/features/store/types'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ShippableMax = number | null | undefined

function increaseBlocked(max: ShippableMax, quantity: number, allowPreorder?: boolean): boolean {
  if (allowPreorder && max === 0) return false
  return typeof max === 'number' && quantity >= max
}

type CartLineProps = {
  item: CartItem
  max: ShippableMax
  displayCurrency: StorePaymentMethods
  convert: (amount: number, from: StorePaymentMethods, to: StorePaymentMethods) => number
  formatPrice: (amount: number, currency: StorePaymentMethods) => string
  onRemove: (productId: string) => void
  onChangeQuantity: (productId: string, quantity: number) => void
  labels: {
    remove: string
    decrease: string
    increase: string
    basePrice: string
    withOptions: string
    itemTotal: string
  }
}

const CartLine = memo(function CartLine({
  item,
  max,
  displayCurrency,
  convert,
  formatPrice,
  onRemove,
  onChangeQuantity,
  labels,
}: CartLineProps) {
  const shelfEmpty =
    !item.product.digitalProduct &&
    !item.product.instantDelivery &&
    !item.product.allowPreorder &&
    (max === 0 || (Boolean(item.waiting) && typeof max !== 'number'))
  const shownQty = shelfEmpty ? 0 : item.quantity
  const rawPrice = item.finalPrice ?? parseFloat(item.product.price)
  const basePrice = parseFloat(item.product.price)
  const from = resolveStorePriceCurrency(item.product.currency || MAIN_CURRENCY)
  const displayPrice = convert(rawPrice, from, displayCurrency)
  const displayBasePrice = convert(basePrice, from, displayCurrency)
  const { lineTotal: rawItemTotal, applied: appliedPromo } = applyProductPromotionToLine(
    rawPrice,
    shownQty,
    item.product.promotions,
  )
  const itemTotal = convert(rawItemTotal, from, displayCurrency)
  const hasVariants = Boolean(item.selectedVariants && Object.keys(item.selectedVariants).length)
  const hasPriceModifier = Boolean(item.finalPrice && item.finalPrice !== basePrice)
  const blocked = shelfEmpty || increaseBlocked(max, shownQty, item.product.allowPreorder)
  const money = (amount: number) => formatPrice(amount, displayCurrency)

  return (
    <div className={`border-b border-border/60 py-4 last:border-b-0 ${shelfEmpty ? 'opacity-60 grayscale' : ''}`}>
      <div className="flex gap-6">
        <div className="flex-shrink-0">
          <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-muted">
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
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 break-words text-lg font-semibold leading-tight">{item.product.name}</h3>
              {item.product.category ? (
                <p className="text-sm text-muted-foreground">{item.product.category}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${labels.remove} ${item.product.name}`}
              onClick={() => onRemove(item.product.id)}
              className="flex-shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {hasVariants ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(item.selectedVariants || {}).map(([name, value]) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium"
                >
                  {name}: <span className="ml-1 font-semibold text-primary">{value}</span>
                </span>
              ))}
            </div>
          ) : null}
          <div className="mb-4 space-y-2">
            {hasPriceModifier ? (
              <>
                <div className="text-sm text-muted-foreground">
                  {labels.basePrice}: <span className="line-through">{money(displayBasePrice)}</span>
                </div>
                <div className="text-sm font-semibold text-primary">
                  {labels.withOptions}: {money(displayPrice)}
                </div>
              </>
            ) : (
              <div className="text-sm font-semibold">{money(displayPrice)}</div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={labels.decrease}
                onClick={() => onChangeQuantity(item.product.id, item.quantity - 1)}
                disabled={shelfEmpty || shownQty <= 1}
                className="h-8 w-8 p-0 hover:bg-background"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-lg font-semibold">{shownQty}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={labels.increase}
                onClick={() => {
                  if (blocked) return
                  onChangeQuantity(item.product.id, item.quantity + 1)
                }}
                disabled={shelfEmpty || blocked}
                className="h-8 w-8 p-0 hover:bg-background"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-right">
              <div className="mb-1 text-xs text-muted-foreground">{labels.itemTotal}</div>
              <div className="text-xl font-bold">{money(itemTotal)}</div>
              {appliedPromo?.label ? <p className="mt-1 text-xs text-green-600">{appliedPromo.label}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default function CartClient({ locale }: { locale: Locale }) {
  const { cartItems, removeFromCart, updateQuantity, totalItems, stockNotice } = useStore()
  const [shippable, setShippable] = useState<Record<string, number | null>>({})
  const [mounted, setMounted] = useState(false)
  const [, startRemoval] = useTransition()
  const [optimisticItems, dropItem] = useOptimistic(
    cartItems,
    (current, productId: string) => current.filter((item) => item.product.id !== productId),
  )

  const {
    convertPrice: convertStorePaymentMethodsPrice,
    currency: displayCurrency,
    formatPrice,
  } = useStorePaymentMethods()

  useEffect(() => {
    setMounted(true)
  }, [])

  const productIds = cartItems.map((item) => item.product.id).join(',')
  const applyShippable = useEffectEvent((rows: Array<{ productId: string; max: number | null }>) => {
    const next: Record<string, number | null> = {}
    for (const row of rows) next[row.productId] = row.max
    setShippable(next)
    for (const item of cartItems) {
      const max = next[item.product.id]
      if (max === 0 && !item.product.allowPreorder && !item.product.digitalProduct && !item.product.instantDelivery) {
        if (!item.waiting) updateQuantity(item.product.id, 0)
        continue
      }
      if (typeof max !== 'number' || item.quantity <= max) continue
      if (max === 0 && item.product.allowPreorder) continue
      updateQuantity(item.product.id, max)
    }
  })

  useEffect(() => {
    if (!productIds) return
    const handle = window.setTimeout(() => {
      void fetch(`/api/store/fulfillment/shippable?ids=${encodeURIComponent(productIds)}`)
        .then((response) => response.json())
        .then((body: { items?: Array<{ productId: string; max: number | null }> }) => {
          applyShippable(body.items || [])
        })
        .catch(() => undefined)
    }, 200)
    return () => window.clearTimeout(handle)
  }, [productIds])

  const tCart = useTranslations('modules.store.cart')
  const tProduct = useTranslations('modules.store.product')
  const labels = useMemo(() => ({
    remove: tCart('remove'),
    decrease: tCart('decreaseQuantity'),
    increase: tCart('increaseQuantity'),
    basePrice: tCart('basePrice'),
    withOptions: tCart('withOptions'),
    itemTotal: tCart('itemTotal'),
  }), [tCart])

  const visibleItems = mounted ? optimisticItems : []
  const visibleTotalItems = mounted ? totalItems : 0

  const removeItem = useEffectEvent((productId: string) => {
    startRemoval(() => {
      dropItem(productId)
      removeFromCart(productId)
    })
  })
  const changeQuantity = useEffectEvent((productId: string, quantity: number) => {
    updateQuantity(productId, quantity)
  })

  return (
    <>
      {stockNotice ? <p className="text-sm text-destructive">{stockNotice}</p> : null}
      <div className="space-y-4">
        {visibleItems.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {visibleTotalItems} {visibleTotalItems === 1 ? tCart('item') : tCart('items')}
          </p>
        ) : null}
        {visibleItems.length === 0 ? (
          <div className="py-12">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-muted/50">
                <ShoppingBag className="h-16 w-16 text-muted-foreground/50" />
              </div>
              <h2 className="mb-3 text-2xl font-bold">{tCart('empty')}</h2>
              <p className="mb-8 text-muted-foreground">{tCart('emptyDescription')}</p>
              <Link href={ROUTES.STORE(locale)}>
                <Button size="lg" className="gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {tProduct('backToStore')}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="pb-28 lg:pb-0">
            <div className="space-y-3">
              {[...visibleItems]
                .sort((a, b) => {
                  const rank = (item: CartItem) =>
                    item.waiting || shippable[item.product.id] === 0 ? 1 : 0
                  return rank(a) - rank(b)
                })
                .map((item) => (
                <CartLine
                  key={item.product.id}
                  item={item}
                  max={shippable[item.product.id]}
                  displayCurrency={displayCurrency}
                  convert={convertStorePaymentMethodsPrice}
                  formatPrice={formatPrice}
                  onRemove={removeItem}
                  onChangeQuantity={changeQuantity}
                  labels={labels}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
