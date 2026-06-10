'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  isProductAgentChatOpenParam,
  PRODUCT_AGENT_CHAT_OPEN_PARAM,
} from '@/features/store/lib/product-agent-chat-url'

type ProductAgentChatContextValue = {
  productId: string
  productName: string
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const ProductAgentChatContext = createContext<ProductAgentChatContextValue | null>(null)

export function ProductAgentChatProvider({
  productId,
  productName,
  children,
}: {
  productId: string
  productName: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (isProductAgentChatOpenParam(params.get(PRODUCT_AGENT_CHAT_OPEN_PARAM))) {
      setOpen(true)
    }
  }, [])

  const value = useMemo(
    () => ({
      productId,
      productName,
      open,
      setOpen,
      toggle: () => setOpen((prev) => !prev),
    }),
    [productId, productName, open],
  )

  return (
    <ProductAgentChatContext.Provider value={value}>{children}</ProductAgentChatContext.Provider>
  )
}

export function useProductAgentChatContext() {
  const context = useContext(ProductAgentChatContext)
  if (!context) {
    throw new Error('useProductAgentChatContext must be used within ProductAgentChatProvider')
  }
  return context
}

export function useOptionalProductAgentChatContext() {
  return useContext(ProductAgentChatContext)
}
