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
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'price-asc', label: 'Price (Low to High)' },
  { value: 'price-desc', label: 'Price (High to Low)' },
  { value: 'newest', label: 'Newest First' },
]

export default function FloatingSortButton({
  currentSort = 'name-asc',
  onSortChange,
  options = DEFAULT_SORT_OPTIONS,
  title = 'Sort Products By',
}: FloatingSortButtonProps) {
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
    options.find((opt) => opt.value === currentSort)?.label || 'Sort'

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
              <div className="border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 p-3">
                <h3 className="flex items-center gap-2 px-2 py-1 text-sm font-semibold">
                  <ArrowUpDown className="h-4 w-4" />
                  {title}
                </h3>
              </div>
              <div className="max-h-80 overflow-y-auto p-3">
                <SortOptionsList
                  options={options}
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
                <div className="border-b border-border bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
                  <h2 className="flex items-center gap-3 text-2xl font-bold">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                      <ArrowUpDown className="h-6 w-6 text-primary" />
                    </div>
                    <span>{title}</span>
                  </h2>
                  <p className="mt-2 ml-[60px] text-sm text-muted-foreground">
                    Choose how to sort your items
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                  <SortOptionsList
                    options={options}
                    currentSort={currentSort}
                    onSelect={handleSortSelect}
                    className="space-y-2"
                  />
                </div>
                <div className="border-t border-border bg-muted/30 p-4">
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                    className="w-full rounded-xl py-6 text-base font-semibold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Button
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full p-0 shadow-lg transition-all hover:shadow-xl',
          'bg-primary hover:bg-primary/90',
          isOpen && 'scale-110 ring-4 ring-primary/20',
          isPending && 'opacity-80',
        )}
        aria-label="Sort items"
        title={currentSortLabel}
      >
        <ArrowUpDown
          className={cn(
            'h-6 w-6 text-primary-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </Button>
    </div>
  )
}
