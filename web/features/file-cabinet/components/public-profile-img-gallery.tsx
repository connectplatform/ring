'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FileCabinetGalleryItem } from '@/features/file-cabinet/types'
import { publicCdnVariantUrl } from '@/features/file-cabinet/media-urls'

/**
 * Full-page public gallery — lightbox controls; CDN derivative URLs from RingFileBase.
 * Grid → thumb.webp; lightbox → original.webp (falls back at CDN if missing).
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
        {items.map((item, index) => {
          const thumb =
            publicCdnVariantUrl(item.storageUrl, 'thumb') || item.storageUrl || ''
          return (
            <button
              key={item.id}
              type="button"
              className="group overflow-hidden rounded-xl border text-left"
              onClick={() => setActive(index)}
            >
              <div className="relative aspect-square bg-muted">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={item.caption || item.name || ''}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
              {item.caption || item.name ? (
                <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                  {item.caption || item.name}
                </p>
              ) : null}
            </button>
          )
        })}
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
              src={
                publicCdnVariantUrl(items[active].storageUrl, 'original_webp') ||
                items[active].storageUrl ||
                ''
              }
              alt={items[active].caption || items[active].name || ''}
              className="max-h-[90vh] w-auto max-w-full object-contain"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={close}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
            {items.length > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  onClick={prev}
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={next}
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
