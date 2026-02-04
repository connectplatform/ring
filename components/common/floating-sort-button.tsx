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
 * - Dropdown menu with sort options
 * - Responsive positioning (upward on mobile, downward on desktop)
 * - Customizable sort options
 * - Backdrop overlay
 */

import { useState, useTransition, useCallback } from 'react'
import { ArrowUpDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SortOption {
  value: string
  label: string
}

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
  { value: 'newest', label: 'Newest First' }
]

export default function FloatingSortButton({ 
  currentSort = 'name-asc',
  onSortChange,
  options = DEFAULT_SORT_OPTIONS,
  title = 'Sort Products By'
}: FloatingSortButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // React 19 useTransition for non-blocking sort changes
  const [isPending, startTransition] = useTransition()

  const handleSortSelect = useCallback((value: string) => {
    startTransition(() => {
      onSortChange?.(value)
      setIsOpen(false)
    })
  }, [onSortChange])

  const currentSortLabel = options.find(opt => opt.value === currentSort)?.label || 'Sort'

  return (
    <div className="relative">
      {/* Sort Options Menu */}
      {isOpen && (
        <>
          {/* Desktop: Dropdown positioned top-left of button */}
          <div className="hidden lg:block">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-transparent z-10"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown Panel - Above and to the left of button */}
            <div className="absolute bottom-full left-0 mb-3 w-72 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
              <div className="p-3 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5">
                <h3 className="text-sm font-semibold px-2 py-1 flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  {title}
                </h3>
              </div>
              <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
                {options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSortSelect(option.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-sm rounded-lg transition-all duration-200",
                      currentSort === option.value 
                        ? "bg-primary text-primary-foreground shadow-md scale-[1.02]" 
                        : "hover:bg-accent hover:text-accent-foreground hover:scale-[1.01]"
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    {currentSort === option.value && (
                      <Check className="h-4 w-4 animate-in zoom-in-50 duration-200" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile/iPad: Full-screen centered modal */}
          <div className="lg:hidden">
            {/* Backdrop with blur */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 animate-in fade-in-0 duration-300"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Centered Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
              <div 
                className="w-full max-w-md bg-popover rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-border bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <ArrowUpDown className="h-6 w-6 text-primary" />
                    </div>
                    <span>{title}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 ml-[60px]">
                    Choose how to sort your items
                  </p>
                </div>

                {/* Sort Options */}
                <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                  {options.map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortSelect(option.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-5 py-4 text-base rounded-xl transition-all duration-200",
                        "border-2",
                        currentSort === option.value 
                          ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02] ring-4 ring-primary/20" 
                          : "bg-card border-border hover:border-primary/50 hover:bg-accent hover:scale-[1.01]",
                        "animate-in fade-in-0 slide-in-from-bottom-4"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="font-semibold">{option.label}</span>
                      {currentSort === option.value && (
                        <div className="h-6 w-6 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                          <Check className="h-4 w-4 animate-in zoom-in-50 duration-200" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Close Button */}
                <div className="p-4 border-t border-border bg-muted/30">
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                    className="w-full py-6 text-base font-semibold rounded-xl"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Sort Button */}
      <Button
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 p-0 rounded-full shadow-lg hover:shadow-xl transition-all",
          "bg-primary hover:bg-primary/90",
          "flex items-center justify-center",
          isOpen && "ring-4 ring-primary/20 scale-110"
        )}
        aria-label="Sort items"
        title={currentSortLabel}
      >
        <ArrowUpDown className={cn(
          "h-6 w-6 text-primary-foreground transition-transform",
          isOpen && "rotate-180"
        )} />
      </Button>
    </div>
  )
}

