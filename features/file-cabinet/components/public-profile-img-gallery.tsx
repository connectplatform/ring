'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FileCabinetGalleryItem } from '@/features/file-cabinet/types'

/**
 * Full-page public gallery — lightbox controls; CDN URLs from RingFileBase.
 * Consolidated strip/lightbox pattern (generative/store style), not a third family.
 */
export function PublicProfileImgGallery({ items }: { items: FileCabinetGalleryItem[] }) {
  const [active, setActive] = useState<number | null>(null)

  const close = useCallback(() => setActive(null), [])
  const prev = useCallback(() => {
    setActive((i) => (i == null ? i : (i + items.length - 1) % items.length))
  }, [items.length])
  const next = useCallback(() => {
    setActive((i) => (i == null ? i : (i + 1) % items.length))
  }, [items.length])

  useEffect(() => {
    if (active == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, close, next, prev])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="group overflow-hidden rounded-xl border text-left"
            onClick={() => setActive(index)}
          >
            <div className="relative aspect-square bg-muted">
              {item.storageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.storageUrl}
                  alt={item.caption || item.name || ''}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : null}
            </div>
            {item.caption || item.name ? (
              <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                {item.caption || item.name}
              </p>
            ) : null}
          </button>
        ))}
      </div>

      {active != null && items[active] ? (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4',
          )}
          role="dialog"
          aria-modal
          onClick={close}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[active].storageUrl || ''}
              alt={items[active].caption || items[active].name || ''}
              className="max-h-[85vh] w-auto rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/80">
              {items[active].caption || items[active].name}
            </p>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <Button type="button" size="icon" variant="secondary" onClick={prev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <Button type="button" size="icon" variant="secondary" onClick={next}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
