"use client"
import React, { createContext, useContext, useEffect, useMemo, useState, useTransition, use } from 'react'
import { usePathname } from 'next/navigation'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { StoreProduct, CartItem, CheckoutInfo } from './types'
import { getClientStoreService } from './client'
import { generateProductEmbedding } from '@/lib/vector-search'
import {
  DEFAULT_CURRENCY,
  resolveStorePriceCurrency,
  type StoreCurrency,
} from '@/features/store/currency-context'

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
  const [service, setService] = useState<ReturnType<any> | null>(null)
  const [, startTransition] = useTransition()
  const pathname = usePathname()
  // Ring's own anti-pattern rule (AI-CONTEXT/concepts/frontend/state-management.json
  // pattern_4_minimal_global_state) disallows full entity catalogs in a global
  // client store. StoreProvider stays mounted globally (nav cart badge needs
  // totalItems on every route), but the product-list network call is deferred
  // until the user is actually on a store route or already has cart items.
  const isStoreRoute = pathname.includes('/store')
  const shouldLoadProducts = isStoreRoute || rawCart.length > 0

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
        currency: DEFAULT_CURRENCY as StoreProduct['currency'],
        inStock: false,
      },
      quantity: Math.max(0, Math.floor(qty)),
    }))
  }, [rawCart, products])

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

  const clearCart = () => setRawCart([])

  const totalItems = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems])

  const totalPriceByCurrency = useMemo(() => {
    return cartItems.reduce<Record<string, number>>((acc, i) => {
      const price = parseFloat(i.product.price || '0') * i.quantity
      const cur = resolveStorePriceCurrency(i.product.currency as StoreCurrency)
      acc[cur] = (acc[cur] || 0) + price
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



