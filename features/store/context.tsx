"use client"
import React, { createContext, useContext, useEffect, useMemo, useState, use } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { StoreProduct, CartItem, CheckoutInfo } from './types'
import { getClientStoreService } from './client'

interface StoreContextType {
  products: StoreProduct[]
  cartItems: CartItem[]
  addToCart: (product: StoreProduct) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPriceByCurrency: Record<'DAAR' | 'DAARION', number>
  checkout: (info: CheckoutInfo) => Promise<{ orderId: string }>
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
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [rawCart, setRawCart] = useLocalStorage<{ id: string; qty: number }[]>(`ring_cart`, [])

  const [service, setService] = useState<ReturnType<any> | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const s = await getClientStoreService()
      if (!mounted) return
      setService(s)
      const list = await s.list()
      if (!mounted) return
      setProducts(Array.isArray(list) ? list : [])
    })()
    return () => { mounted = false }
  }, [])

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
    <StoreContext.Provider value={{ products, cartItems, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPriceByCurrency, checkout }}>
      {children}
    </StoreContext.Provider>
  )
}



