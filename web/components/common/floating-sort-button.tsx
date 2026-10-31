'use client'

/**
 * Floating Sort Button - Reusable Component
 *
 * Used across multiple feeds:
 * - Store Products
 * - Opportunities
 * - Entities
 * - NFT Marketplace
 * - News Feed
 *
 * Features:
 * - Dropdown menu with sort options (shared SortOptionsList / SortOption)
 * - Responsive positioning (upward on mobile, downward on desktop)
 * - Customizable sort options
 * - Backdrop overlay
 *
 * Toolbar chrome: use SortByMenu instead (same SortOption contract).
 */

import { useState, useTransition, useCallback } from 'react'
import { ArrowUpDown, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  type SortOption,
  SortOptionsList,
} from '@/components/common/sort-by-menu'

export type { SortOption }

interface FloatingSortButtonProps {
  currentSort?: string
  onSortChange?: (sortBy: string) => void
  options?: SortOption[]
  title?: string
}

export default function FloatingSortButton({
  currentSort = 'name-asc',
  onSortChange,
  options,
  title,
}: FloatingSortButtonProps) {
  const t = useTranslations('modules.store.sort')
  const tClose = useTranslations('common.actions')
  const resolvedTitle = title ?? t('title')
  const resolvedOptions = options ?? [
    { value: 'name-asc', label: t('nameAsc') },
    { value: 'name-desc', label: t('nameDesc') },
    { value: 'price-asc', label: t('priceAsc') },
    { value: 'price-desc', label: t('priceDesc') },
    { value: 'newest', label: t('newest') },
  ]
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSortSelect = useCallback(
    (value: string) => {
      startTransition(() => {
        onSortChange?.(value)
        setIsOpen(false)
      })
    },
    [onSortChange],
  )

  const currentSortLabel =
    resolvedOptions.find((opt) => opt.value === currentSort)?.label || t('fallback')

  return (
    <div className="relative">
      {isOpen && (
        <>
          <div className="hidden lg:block">
            <div
              className="fixed inset-0 z-10 bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute bottom-full left-0 z-20 mb-3 w-72 animate-in overflow-hidden rounded-xl border border-border bg-popover shadow-2xl fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <h3 className="text-sm font-semibold">{resolvedTitle}</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                  aria-label={tClose('close')}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto p-3">
                <SortOptionsList
                  options={resolvedOptions}
                  currentSort={currentSort}
                  onSelect={handleSortSelect}
                />
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <div
              className="fixed inset-0 z-50 animate-in bg-black/60 backdrop-blur-md fade-in-0 duration-300"
              onClick={() => setIsOpen(false)}
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
              <div
                className="pointer-events-auto w-full max-w-md animate-in overflow-hidden rounded-2xl bg-popover shadow-2xl fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <h2 className="text-base font-semibold">{resolvedTitle}</h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                    aria-label={tClose('close')}
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                  <SortOptionsList
                    options={resolvedOptions}
                    currentSort={currentSort}
                    onSelect={handleSortSelect}
                    className="space-y-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isOpen && 'scale-110 ring-4 ring-primary/20',
          isPending && 'opacity-80',
        )}
        aria-label={t('items')}
        title={currentSortLabel}
      >
        <ArrowUpDown
          className={cn('h-6 w-6 transition-transform', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>
    </div>
  )
}
