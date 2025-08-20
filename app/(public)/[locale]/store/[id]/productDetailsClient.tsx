'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { useStore } from '@/features/store/context'
import type { Locale } from '@/i18n-config'
import { useLocalStorage } from '@/hooks/use-local-storage'
import Chat from '@/features/chat/components/chat'
import { useToast } from '@/hooks/use-toast'
import { useTranslations } from 'next-intl'

export default function ProductDetailsClient({ locale, id }: { locale: Locale; id: string }) {
  const { products, addToCart } = useStore()
  const [adding, setAdding] = useState(false)
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const { success } = useToast()
  const t = useTranslations('modules.store')
  const product = useMemo(() => products.find(p => p.id === id), [products, id])
  const isFavorite = useMemo(() => favorites.includes(id), [favorites, id])
  const toggleFavorite = () => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Compute related products list before any early returns to satisfy hooks order rules
  const related = useMemo(() => {
    const ids = product?.relatedProductIds || []
    return ids.map(rid => products.find(p => p.id === rid)).filter(Boolean)
  }, [product, products])

  if (!product && products.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Loading…</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded min-h-[200px] bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Product not found</h1>
        <Link className="underline" href={ROUTES.STORE(locale)}>Back to store</Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-3">
        <div className="border rounded min-h-[200px] bg-muted mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{product.name}</h1>
        {product.description && (<p className="text-muted-foreground mb-4">{product.description}</p>)}
        {product.category && (
          <div className="text-sm mb-2">{t('product.category')}: {product.category}</div>
        )}
        {product.tags && product.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {product.tags.map(tag => (<span key={tag} className="px-2 py-1 bg-muted rounded">#{tag}</span>))}
          </div>
        )}
        <div className="mb-4">{t('product.price')}: {product.price} {product.currency}</div>
        <div className="flex gap-3 flex-wrap items-center">
          <button
            className={`px-4 py-2 rounded bg-blue-600 text-white ${adding ? 'opacity-70 cursor-not-allowed animate-pulse' : ''}`}
            onClick={async () => { if (adding) return; setAdding(true); try { await Promise.resolve(addToCart(product)); await new Promise(r => setTimeout(r, 600)); success({ title: t('product.addedToCart', { name: product.name }) }) } finally { setAdding(false) } }}
            disabled={adding}
            aria-busy={adding}
          >{adding ? t('product.adding') : t('product.addToCart')}</button>
          <button className="underline text-sm" onClick={toggleFavorite}>{isFavorite ? (t('favorites.remove') ?? 'Remove from favorites') : (t('favorites.save') ?? 'Save to favorites')}</button>
          <Link className="underline" href={ROUTES.CART(locale)}>{t('product.goToCart')}</Link>
        </div>
      </div>
      <div className="md:col-span-1">
        <div className="border rounded p-0 mb-4 overflow-hidden">
          <div className="px-3 pt-3">
            <h2 className="font-semibold mb-2">{t('aiConsultant.title')}</h2>
            <p className="text-sm text-muted-foreground mb-3">{t('aiConsultant.ask')}</p>
          </div>
          <div className="h-[420px] md:h-[520px]">
            <div className="h-full">
              <Chat entityId={id} entityName={product.name} showConversationList={false} className="h-full" />
            </div>
          </div>
        </div>
        {related.length > 0 && (
          <div className="border rounded p-3">
            <h3 className="font-semibold mb-2 text-sm">{t('product.goesWellWith')}</h3>
            <div className="space-y-2">
              {related.map((rp: any) => (
                <Link key={rp.id} href={`${ROUTES.STORE(locale)}/${rp.id}`} className="text-sm underline block truncate">{rp.name}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


