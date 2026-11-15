'use client'

/**
 * Store checkout deep-link: preload the cart before the checkout UI renders.
 * Used by white-label marketing sites ("Add to cart" → straight to checkout).
 *
 * Supported params:
 *   ?product=<id>&qty=<n>                       — single item
 *   ?products=<id,id,id>&qtys=<n,n,n>           — parallel lists (quote-shaped orders:
 *                                                 e.g. annual service ×N + activation ×1)
 *
 * Idempotent: one add per mount (Strict-Mode safe via handledRef), parameters are
 * stripped from the URL after the add so a refresh cannot re-add.
 */
import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useStore } from '@/features/store/context'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import type { StoreProduct } from '@/features/store/types'

function stubProduct(id: string): StoreProduct {
  return {
    id,
    name: id,
    price: '0',
    currency: getMainCurrencySymbol(),
    inStock: true,
  } as unknown as StoreProduct
}

function CheckoutDeepLinkInner() {
  const { addToCart, cartItems } = useStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)

  // Resolve the deep-link line list: parallel `products`/`qtys` or single `product`/`qty`.
  const productsParam = searchParams.get('products')
  const qtysParam = searchParams.get('qtys')
  const lines = productsParam
    ? productsParam
        .split(',')
        .map((id, i) => ({
          id: id.trim(),
          qty: Math.max(1, Math.floor(Number(qtysParam?.split(',')[i] ?? '1')) || 1),
        }))
        .filter((l) => l.id)
    : (() => {
        const id = searchParams.get('product')
        if (!id) return []
        const qty = Math.max(1, Math.floor(Number(searchParams.get('qty') ?? '1')) || 1)
        return [{ id, qty }]
      })()

  useEffect(() => {
    if (handledRef.current || lines.length === 0) return
    handledRef.current = true
    const inCart = new Set(cartItems.map((i) => i.product?.id))
    for (const line of lines) {
      if (inCart.has(line.id)) continue
      // Stub product: cartItems resolves the real catalog entry once the
      // store product list finishes loading (same single-flight fetch).
      void addToCart(stubProduct(line.id), { next: line.qty })
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete('product')
    next.delete('qty')
    next.delete('products')
    next.delete('qtys')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [lines, cartItems, addToCart, pathname, router, searchParams])

  return null
}

export default function CheckoutDeepLink() {
  return (
    <Suspense fallback={null}>
      <CheckoutDeepLinkInner />
    </Suspense>
  )
}
