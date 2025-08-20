'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import type { StoreProduct } from '@/features/store'
import { useStore } from '@/features/store/context'
import type { Locale } from '@/i18n-config'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

export function ProductCard({ product, locale }: { product: StoreProduct, locale: Locale }) {
  const { addToCart } = useStore()
  const [adding, setAdding] = useState(false)
  const { success } = useToast()
  const t = useTranslations('modules.store.product')
  const handleAdd = async () => {
    if (adding) return
    setAdding(true)
    try {
      await Promise.resolve(addToCart(product))
      // Ensure the visual state is noticeable
      await new Promise(res => setTimeout(res, 600))
      success({ title: t('addedToCart', { name: product.name }) })
    } finally {
      setAdding(false)
    }
  }
  return (
    <div className="border rounded p-4">
      <Link href={`${ROUTES.STORE(locale)}/${product.id}`} className="font-medium underline">
        {product.name}
      </Link>
      {product.description && (<div className="text-sm text-muted-foreground mb-2">{product.description}</div>)}
      <div className="text-sm">{t('price')}: {product.price} {product.currency}</div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">{t('inStockYes')}: {product.inStock ? t('inStockYes') : t('inStockNo')}</div>
        <button
          className={`underline ${adding ? 'opacity-60 cursor-not-allowed animate-pulse' : ''}`}
          onClick={handleAdd}
          disabled={adding}
          aria-busy={adding}
          aria-label={adding ? t('adding') : t('addToCart')}
        >
          {adding ? t('adding') : t('addToCart')}
        </button>
      </div>
    </div>
  )
}


