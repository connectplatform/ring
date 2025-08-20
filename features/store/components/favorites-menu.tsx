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
  const [favorites] = useLocalStorage<string[]>('ring_favorites', [])
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
    const list = store?.products || []
    return favorites
      .map(id => list.find(p => p.id === id))
      .filter(Boolean) as Array<{ id: string; name: string }>
  }, [favorites, store?.products])

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="inline-flex items-center gap-1"
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        title={t('button')}
      >
        <Heart className="h-5 w-5" />
        <span className="inline-grid place-items-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">{mounted ? favorites.length : 0}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border rounded shadow p-3 z-50" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          {resolved.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <div className="space-y-2">
              {resolved.slice(0, 8).map(p => (
                <Link key={p.id} href={`${ROUTES.STORE(locale)}/${p.id}`} className="block text-sm underline truncate" onClick={() => setOpen(false)}>
                  {p.name}
                </Link>
              ))}
              {resolved.length > 8 && (
                <div className="text-xs text-muted-foreground">+{resolved.length - 8} more</div>
              )}
              <div className="flex gap-3 text-sm">
                <Link className="underline" href={ROUTES.STORE(locale)} onClick={() => setOpen(false)}>{t('browseStore')}</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


