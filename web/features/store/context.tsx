"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, use, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { StoreProduct, CartItem, CheckoutInfo } from './types'
import { getClientStoreService } from './client'
import { generateProductEmbedding } from '@/lib/vector-search'
import {
  MAIN_CURRENCY,
  resolveStorePriceCurrency,
  type StorePaymentMethods,
} from '@/features/store/currency-context'
import { STORE_CART_UPDATED_EVENT } from '@/hooks/use-product-agent-chat'
import { cartLineVendorId, priceCartLine } from '@/features/store/lib/cart-pricing'

interface StoreContextType {
  // Legacy support
  products: StoreProduct[]

  // ERP Extension: Enhanced products with vendor data
  enhancedProducts: StoreProduct[]
  qualityRecommendations: StoreProduct[]
  sustainableProducts: StoreProduct[]
  aiRecommendedProducts: StoreProduct[]

  cartItems: CartItem[]
  addToCart: (product: StoreProduct) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  appliedPromoCode: string | null
  setAppliedPromoCode: (code: string | null) => void
  /** Public shipping + active promo codes. Null until the settings request returns. */
  storefrontSettings: import('@/features/store/types/store-settings').StoreSettingsData | null
  totalItems: number
  /** Totals keyed by resolved catalog currency (ring-config SSOT). */
  totalPriceByCurrency: Record<string, number>
  checkout: (info: CheckoutInfo) => Promise<{ orderId: string }>

  // ERP Extension: Loading states
  isLoadingEnhanced: boolean
  refreshEnhancedProducts: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | null>(null)

/**
 * Pure transform: raw product list -> enhanced list + recommendation buckets.
 * SSOT shared by the initial deferred load and manual refreshEnhancedProducts
 * so both paths derive recommendations identically (manual refresh previously
 * skipped quality/sustainable/aiRecommended — now consistent).
 */
function buildEnhancedProductSets(rawList: StoreProduct[]) {
  const productList = Array.isArray(rawList) ? rawList : []
  const enhancedWithEmbeddings = productList.map(product => ({
    ...product,
    embedding: generateProductEmbedding({
      name: product.name,
      description: product.description,
      category: product.category,
      tags: product.tags,
    }),
  }))

  const qualityProducts = enhancedWithEmbeddings.filter(p =>
    p.tags?.includes('organic') || p.tags?.includes('premium') || (p.rating && p.rating >= 4.5)
  ).slice(0, 10)

  const sustainableList = enhancedWithEmbeddings.filter(p =>
    p.tags?.includes('eco') || p.tags?.includes('sustainable') || p.tags?.includes('organic')
  ).slice(0, 10)

  const shuffled = [...enhancedWithEmbeddings].sort(() => Math.random() - 0.5)

  return {
    productList,
    enhancedWithEmbeddings,
    qualityRecommendations: qualityProducts.length > 0 ? qualityProducts : enhancedWithEmbeddings.slice(0, 10),
    sustainableProducts: sustainableList.length > 0 ? sustainableList : enhancedWithEmbeddings.slice(0, 10),
    aiRecommendedProducts: shuffled.slice(0, 10),
  }
}

/**
 * Module-scope single-flight for the raw product list network call — dedupes
 * concurrent StoreProvider mounts (Strict Mode) to one `GET /api/store/products`.
 * Mirrors `initializeDatabaseInFlight` in `lib/database/DatabaseService.ts`.
 */
let storeProductsInFlight: Promise<StoreProduct[]> | null = null

function fetchStoreProductsSingleFlight(storeService: { list: () => Promise<unknown> }): Promise<StoreProduct[]> {
  if (storeProductsInFlight) return storeProductsInFlight

  storeProductsInFlight = storeService
    .list()
    .then((list) => (Array.isArray(list) ? (list as StoreProduct[]) : []))
    .finally(() => {
      storeProductsInFlight = null
    })

  return storeProductsInFlight
}

export function useStore(): StoreContextType {
  const ctx = use(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function useOptionalStore(): StoreContextType | null {
  return use(StoreContext)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Legacy products for backward compatibility
  const [products, setProducts] = useState<StoreProduct[]>([])

  // ERP Extension: Enhanced products with vendor data
  const [enhancedProducts, setEnhancedProducts] = useState<StoreProduct[]>([])
  const [qualityRecommendations, setQualityRecommendations] = useState<StoreProduct[]>([])
  const [sustainableProducts, setSustainableProducts] = useState<StoreProduct[]>([])
  const [aiRecommendedProducts, setAiRecommendedProducts] = useState<StoreProduct[]>([])
  const [isLoadingEnhanced, setIsLoadingEnhanced] = useState(false)

  const [rawCart, setRawCart] = useLocalStorage<{ id: string; qty: number }[]>(`ring_cart`, [])
  const [appliedPromoCode, setAppliedPromoCode] = useLocalStorage<string | null>('ring_store_promo', null)
  const [storefrontSettings, setStorefrontSettings] = useState<import('@/features/store/types/store-settings').StoreSettingsData | null>(null)
  const [service, setService] = useState<ReturnType<any> | null>(null)
  const [, startTransition] = useTransition()
  const pathname = usePathname()
  const { status: authStatus } = useSession()
  const skipNextServerPush = useRef(false)
  // Ring's own anti-pattern rule (AI-CONTEXT/concepts/frontend/state-management.json
  // pattern_4_minimal_global_state) disallows full entity catalogs in a global
  // client store. StoreProvider stays mounted globally (nav cart badge needs
  // totalItems on every route), but the product-list network call is deferred
  // until the user is actually on a store route or already has cart items.
  const isStoreRoute = pathname.includes('/store')
  const shouldLoadProducts = isStoreRoute || rawCart.length > 0

  const hydrateFromServer = useCallback(async () => {
    if (authStatus !== 'authenticated') return
    try {
      const res = await fetch('/api/store/cart', { credentials: 'include' })
      if (!res.ok) return
      const json = (await res.json()) as {
        data?: { items?: Array<{ id: string; qty: number }> }
      }
      const items = Array.isArray(json.data?.items) ? json.data!.items! : []
      skipNextServerPush.current = true
      setRawCart(
        items
          .filter((i) => i && typeof i.id === 'string' && Number.isFinite(i.qty))
          .map((i) => ({ id: i.id, qty: Math.max(1, Math.floor(i.qty)) })),
      )
    } catch {
      /* offline */
    }
  }, [authStatus, setRawCart])

  // Authenticated: server cart wins on hydrate (agent tools + UI SSOT)
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    void hydrateFromServer()
  }, [authStatus, hydrateFromServer])

  useEffect(() => {
    const onUpdated = () => {
      void hydrateFromServer()
    }
    window.addEventListener(STORE_CART_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(STORE_CART_UPDATED_EVENT, onUpdated)
  }, [hydrateFromServer])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const s = await getClientStoreService()
      if (!mounted) return
      setService(s)

      if (!shouldLoadProducts) return

      setIsLoadingEnhanced(true)
      try {
        const productList = await fetchStoreProductsSingleFlight(s)
        if (!mounted) return

        const sets = buildEnhancedProductSets(productList)
        startTransition(() => {
          setProducts(sets.productList)
          setEnhancedProducts(sets.enhancedWithEmbeddings)
          setQualityRecommendations(sets.qualityRecommendations)
          setSustainableProducts(sets.sustainableProducts)
          setAiRecommendedProducts(sets.aiRecommendedProducts)
        })
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        if (mounted) setIsLoadingEnhanced(false)
      }
    })()
    return () => { mounted = false }
  }, [shouldLoadProducts])

  // ERP Extension: Refresh products (for manual refresh only) — always hits
  // the network fresh, bypassing the single-flight cache used by initial load.
  const loadEnhancedProducts = async (storeService: any) => {
    if (!storeService) return

    try {
      setIsLoadingEnhanced(true)
      const rawList = await storeService.list()
      const sets = buildEnhancedProductSets(Array.isArray(rawList) ? rawList : [])
      startTransition(() => {
        setProducts(sets.productList)
        setEnhancedProducts(sets.enhancedWithEmbeddings)
        setQualityRecommendations(sets.qualityRecommendations)
        setSustainableProducts(sets.sustainableProducts)
        setAiRecommendedProducts(sets.aiRecommendedProducts)
      })
    } catch (error) {
      console.error('Error refreshing products:', error)
    } finally {
      setIsLoadingEnhanced(false)
    }
  }

  // ERP Extension: Refresh enhanced products
  const refreshEnhancedProducts = async () => {
    if (service) {
      await loadEnhancedProducts(service)
    }
  }

  const cartItems: CartItem[] = useMemo(() => {
    const safeProducts = Array.isArray(products) ? products : []
    const productMap = new Map(safeProducts.map(p => [p.id, p]))
    const source = Array.isArray(rawCart)
      ? rawCart.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.qty === 'number' && Number.isFinite(entry.qty))
      : []
    return source.map(({ id, qty }) => ({
      product: productMap.get(id) || {
        id,
        name: 'Unknown',
        price: '0',
        currency: MAIN_CURRENCY as StoreProduct['currency'],
        inStock: false,
      },
      quantity: Math.max(0, Math.floor(qty)),
    }))
  }, [rawCart, products])

  const singleCartVendorId = useMemo(() => {
    const ids = [...new Set(cartItems.map((item) => cartLineVendorId(item.product)).filter(Boolean))]
    return ids.length === 1 ? ids[0] : ''
  }, [cartItems])

  useEffect(() => {
    let cancelled = false
    const url = singleCartVendorId
      ? `/api/store/settings?vendorId=${encodeURIComponent(singleCartVendorId)}`
      : '/api/store/settings'
    void fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.shipping) return
        const codes = Array.isArray(body.promoCodes) ? body.promoCodes : []
        setStorefrontSettings({
          shipping: body.shipping,
          promotions: {
            promoCodes: codes.map((code: {
              code: string
              discountType: 'percent' | 'fixed'
              value: number
              minOrderAmount?: number
              vendorEntityId?: string | null
              startsAt?: string
              endsAt?: string
              maxRedemptions?: number
              redemptionCount?: number
            }) => ({
              id: code.code,
              code: code.code,
              discountType: code.discountType === 'percent' ? 'percent' : 'fixed',
              value: Number(code.value) || 0,
              minOrderAmount: Number(code.minOrderAmount) || 0,
              enabled: true,
              vendorEntityId: code.vendorEntityId || null,
              startsAt: code.startsAt,
              endsAt: code.endsAt,
              maxRedemptions: code.maxRedemptions,
              redemptionCount: code.redemptionCount,
            })),
            freeShipping: body.freeShipping || { mode: 'off' },
            checkoutSpecialOfferEnabled: Boolean(body.checkoutSpecialOfferEnabled),
          },
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [singleCartVendorId])

  // Authenticated: soft-hold + push server cart mirror (skip one tick after hydrate).
  // Use rawCart ids — never filter on product.name === 'Unknown' (products may still
  // be loading; that filter emptied holds and wiped the server mirror).
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const timer = setTimeout(() => {
      if (skipNextServerPush.current) {
        skipNextServerPush.current = false
        return
      }

      const lines = (Array.isArray(rawCart) ? rawCart : [])
        .filter(
          (entry) =>
            entry &&
            typeof entry.id === 'string' &&
            entry.id &&
            typeof entry.qty === 'number' &&
            Number.isFinite(entry.qty) &&
            entry.qty > 0,
        )
        .map((entry) => {
          const product = cartItems.find((c) => c.product?.id === entry.id)?.product
          return {
            productId: entry.id,
            quantity: Math.max(1, Math.floor(entry.qty)),
            digitalProduct: product?.digitalProduct,
            instantDelivery: product?.instantDelivery,
          }
        })

      // Server cart write already syncs soft-holds — avoid double /hold race.
      void fetch('/api/store/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.productId, qty: l.quantity })),
        }),
        credentials: 'include',
      }).catch(() => {
        /* offline */
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [rawCart, cartItems, authStatus])

  const addToCart = (product: StoreProduct) => {
    setRawCart(prev => {
      const found = prev.find(i => i.id === product.id)
      if (found) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, qty: 1 }]
    })
  }

  const removeFromCart = (productId: string) => {
    setRawCart(prev => prev.filter(i => i.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(productId)
    setRawCart(prev => prev.map(i => i.id === productId ? { ...i, qty: quantity } : i))
  }

  const clearCart = () => {
    setRawCart([])
    setAppliedPromoCode(null)
  }

  const totalItems = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems])

  const totalPriceByCurrency = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, i) => {
      const unit = i.finalPrice ?? parseFloat(i.product.price || '0')
      const priced = priceCartLine(unit, i.quantity, i.product.promotions)
      const cur = resolveStorePriceCurrency(i.product.currency as StorePaymentMethods)
      acc[cur] = (acc[cur] || 0) + priced.lineTotal
      return acc
    }, {})
  }, [cartItems])

  const checkout = async (info: CheckoutInfo) => {
    if (!service) throw new Error('Store service not ready')
    const result = await service.checkout(cartItems, info)
    clearCart()
    return result
  }

  return (
    <StoreContext.Provider value={{
      // Legacy support
      products,

      // ERP Extension: Enhanced products
      enhancedProducts,
      qualityRecommendations,
      sustainableProducts,
      aiRecommendedProducts,

      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      appliedPromoCode,
      setAppliedPromoCode,
      storefrontSettings,
      totalItems,
      totalPriceByCurrency,
      checkout,

      // ERP Extension: Loading states
      isLoadingEnhanced,
      refreshEnhancedProducts
    }}>
      {children}
    </StoreContext.Provider>
  )
}



