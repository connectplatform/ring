'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants/routes'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useOptionalStore } from '@/features/store/context'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'

export function FavoritesMenu({ locale }: { locale: Locale }) {
  const [favorites, setFavorites] = useLocalStorage<string[]>('ring_favorites', [])
  const store = useOptionalStore()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const t = useTranslations('modules.store.favorites')
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return
    let hoverWithin = false
    const onEnter = () => { hoverWithin = true; setOpen(true) }
    const onLeave = () => { hoverWithin = false; setTimeout(() => { if (!hoverWithin) setOpen(false) }, 200) }
    node.addEventListener('mouseenter', onEnter)
    node.addEventListener('mouseleave', onLeave)
    return () => {
      node.removeEventListener('mouseenter', onEnter)
      node.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const resolved = React.useMemo(() => {
    // Try enhanced products first, then fall back to legacy products
    const enhancedList = store?.enhancedProducts || []
    const legacyList = store?.products || []
    const allProducts = [...enhancedList, ...legacyList]

    return favorites
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean) as Array<{ id: string; name: string; price?: string | number; currency?: string }>
  }, [favorites, store?.enhancedProducts, store?.products])

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="inline-flex items-center gap-1 hover:bg-accent/50 rounded p-1 transition-colors"
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        title={t('button')}
      >
        <Heart className="h-5 w-5" />
        <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">{mounted ? favorites.length : 0}</span>
      </button>
      {open && (
        <div className="fixed left-0 top-[140px] w-[280px] bottom-[80px] bg-popover/95 backdrop-blur-sm border-r border-l border-border z-40 overflow-y-auto" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-5 w-5" />
              <span className="font-semibold">{t('button')}</span>
              <Badge variant="secondary">{resolved.length} items</Badge>
            </div>
            {resolved.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t('empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {resolved.map(p => (
                  <div key={p.id} className="p-3 bg-background/50 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`${ROUTES.STORE(locale)}/${p.id}`}
                          className="block font-medium text-sm hover:text-primary transition-colors truncate"
                          onClick={() => setOpen(false)}
                        >
                          {p.name}
                        </Link>
                        {p.price && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {typeof p.price === 'number' ? p.price.toFixed(2) : p.price} {p.currency || 'DAAR'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          // Remove from favorites
                          setFavorites(favorites.filter(id => id !== p.id))
                        }}
                        className="text-destructive hover:text-destructive/80 text-sm ml-2 flex-shrink-0"
                        title="Remove from favorites"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3 mt-4">
                  <Link
                    className="w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium block"
                    href={ROUTES.STORE(locale)}
                    onClick={() => setOpen(false)}
                  >
                    {t('browseStore')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


