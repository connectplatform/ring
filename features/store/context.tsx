"use client"
import React, { createContext, useContext, useEffect, useMemo, useState, use } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { StoreProduct, CartItem, CheckoutInfo } from './types'
import { getClientStoreService } from './client'
import { generateProductEmbedding } from '@/lib/vector-search'

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
  totalPriceByCurrency: Record<'DAAR' | 'DAARION', number>
  checkout: (info: CheckoutInfo) => Promise<{ orderId: string }>

  // ERP Extension: Loading states
  isLoadingEnhanced: boolean
  refreshEnhancedProducts: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | null>(null)

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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const s = await getClientStoreService()
      if (!mounted) return
      setService(s)

      // Load products once and use for both legacy and enhanced
      setIsLoadingEnhanced(true)
      try {
        const list = await s.list()
        if (!mounted) return
        
        const productList = Array.isArray(list) ? list : []
        setProducts(productList)

        // Generate embeddings for products (fast, local operation)
        const enhancedWithEmbeddings = productList.map(product => ({
          ...product,
          embedding: generateProductEmbedding({
            name: product.name,
            description: product.description,
            category: product.category,
            tags: product.tags
          })
        }))
        setEnhancedProducts(enhancedWithEmbeddings)
        
        // Set recommendations from the same product list (no additional DB calls)
        // Quality: products with high ratings or organic tags
        const qualityProducts = enhancedWithEmbeddings.filter(p => 
          p.tags?.includes('organic') || p.tags?.includes('premium') || p.rating && p.rating >= 4.5
        ).slice(0, 10)
        setQualityRecommendations(qualityProducts.length > 0 ? qualityProducts : enhancedWithEmbeddings.slice(0, 10))
        
        // Sustainable: products with eco/sustainable tags
        const sustainableList = enhancedWithEmbeddings.filter(p =>
          p.tags?.includes('eco') || p.tags?.includes('sustainable') || p.tags?.includes('organic')
        ).slice(0, 10)
        setSustainableProducts(sustainableList.length > 0 ? sustainableList : enhancedWithEmbeddings.slice(0, 10))
        
        // AI Recommended: random selection for now (can be enhanced later)
        const shuffled = [...enhancedWithEmbeddings].sort(() => Math.random() - 0.5)
        setAiRecommendedProducts(shuffled.slice(0, 10))
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setIsLoadingEnhanced(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // ERP Extension: Refresh products (for manual refresh only)
  const loadEnhancedProducts = async (storeService: any) => {
    // This is now only used for manual refresh, not initial load
    if (!storeService) return

    try {
      setIsLoadingEnhanced(true)
      const productList = await storeService.list()
      const enhancedWithEmbeddings = Array.isArray(productList) ? productList.map(product => ({
        ...product,
        embedding: generateProductEmbedding({
          name: product.name,
          description: product.description,
          category: product.category,
          tags: product.tags
        })
      })) : []
      setEnhancedProducts(enhancedWithEmbeddings)
      setProducts(Array.isArray(productList) ? productList : [])
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
      product: productMap.get(id) || { id, name: 'Unknown', price: '0', currency: 'DAAR', inStock: false },
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
    return cartItems.reduce<Record<'DAAR' | 'DAARION', number>>((acc, i) => {
      const price = parseFloat(i.product.price || '0') * i.quantity
      const cur = i.product.currency
      acc[cur] = (acc[cur] || 0) + price
      return acc
    }, { DAAR: 0, DAARION: 0 })
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



