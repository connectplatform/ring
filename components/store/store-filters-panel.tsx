'use client'

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react'
import { useTranslations } from 'next-intl'
// ... other imports
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { useOptionalStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import { PRICE_MIN, type StoreFilterState } from '@/lib/store-constants'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Search,
  X,
  ChevronDown,
  Package,
  ShoppingCart,
  CreditCard,
  Store,
  Carrot,
  Apple,
  Leaf,
  Milk,
  Drumstick,
  Wheat,
  Cookie,
  Droplet,
  Croissant,
  Coffee,
  Tractor
} from 'lucide-react'

interface StoreFiltersPanelProps {
  locale: Locale
  initialFilters?: Partial<StoreFilterState>
  totalRecords?: number
  filteredRecords?: number
  onFiltersApplied?: (filters: StoreFilterState) => void
}

// Agricultural Product Categories - GreenFood.live taxonomy
const productCategories = [
  'fresh-vegetables',
  'fresh-fruits',
  'herbs-greens',
  'dairy-eggs',
  'meat-poultry',
  'grains-cereals',
  'legumes-beans',
  'nuts-seeds',
  'honey-sweeteners',
  'preserves-pickles',
  'baked-goods',
  'beverages',
  'farm-supplies',
  'other'
]

const currencies = ['USD', 'UAH', 'DAAR', 'DAARION']

interface StoreFiltersPanelPropsWithPersisted extends StoreFiltersPanelProps {
  persistedFilters?: StoreFilterState // Filters from localStorage/parent
  priceRangeFromDB?: { minPrice: number; maxPrice: number } | null // Price range from database
}

export default function StoreFiltersPanel({
  locale,
  initialFilters,
  totalRecords = 0,
  filteredRecords,
  onFiltersApplied,
  persistedFilters,
  priceRangeFromDB
}: StoreFiltersPanelPropsWithPersisted) {
  const t = useTranslations('modules.store')
  const store = useOptionalStore()
  const totalItems = store?.totalItems || 0

  const currencyContext = useOptionalCurrency()
  const displayCurrency = currencyContext?.currency || 'UAH'

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['categories']))
  const [priceMax, setPriceMax] = useState<number | null>(null)

  // Track if we're currently applying filters to prevent loops
  const isApplyingFilters = useRef(false)
  const priceChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  // Initialize filters once
  const [filters, setFilters] = useState<StoreFilterState>(() =>
    persistedFilters || {
      search: '',
      categories: [],
      priceMin: PRICE_MIN,
      priceMax: null,
      currency: displayCurrency,
      vendor: '',
      inStock: null,
      sortBy: 'name-asc',
      ...initialFilters
    }
  )

  // ✅ Fixed: updateFilters using functional setState pattern
  const updateFilters = useCallback((updates: Partial<StoreFilterState>) => {
    startTransition(() => {
      setFilters(currentFilters => {
        const newFilters = { ...currentFilters, ...updates }
        // Mark for notification in useEffect (React 19 pattern)
        isApplyingFilters.current = true
        return newFilters
      })
    })
  }, [startTransition])

  // Notify parent when filters change (React 19 pattern: useEffect instead of setState callback)
  useEffect(() => {
    if (isApplyingFilters.current && onFiltersApplied) {
      onFiltersApplied(filters)
      isApplyingFilters.current = false
    }
  }, [filters, onFiltersApplied])

  // Fetch price range - one time only
  useEffect(() => {
    let isCancelled = false
    const fetchPriceRange = async () => {
      try {
        const res = await fetch('/api/store/price-range', { cache: 'no-store' })
        if (!isCancelled && res.ok) {
          const data = await res.json()
          if (data.maxPrice && data.maxPrice > 0) {
            const dynamicMax = Math.ceil(data.maxPrice)
            setPriceMax(dynamicMax)
            // Only update if not already set
            setFilters(current =>
              current.priceMax === null
                ? { ...current, priceMax: dynamicMax }
                : current
            )
          }
        }
      } catch (err) {
        console.warn('Failed to fetch price range:', err)
      }
    }
    void fetchPriceRange()
    return () => {
      isCancelled = true
    }
  }, []) // ✅ Empty deps, runs once

  // ✅ Debounced price change handler
  const handlePriceChange = useCallback((values: number[]) => {
    // Clear existing timeout
    if (priceChangeTimeoutRef.current) {
      clearTimeout(priceChangeTimeoutRef.current)
    }
    // Update local state immediately for UI responsiveness
    setFilters(current => ({
      ...current,
      priceMin: values[0],
      priceMax: values[1]
    }))
    // Debounce the actual filter application
    priceChangeTimeoutRef.current = setTimeout(() => {
      updateFilters({ priceMin: values[0], priceMax: values[1] })
    }, 300) // 300ms debounce
  }, [updateFilters])

  // Update currency when context changes
  useEffect(() => {
    if (displayCurrency !== filters.currency) {
      updateFilters({ currency: displayCurrency })
    }
  }, [displayCurrency, filters.currency, updateFilters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (priceChangeTimeoutRef.current) {
        clearTimeout(priceChangeTimeoutRef.current)
      }
    }
  }, [])

  const handleClearFilters = useCallback(() => {
    const clearedFilters: StoreFilterState = {
      search: '',
      categories: [],
      priceMin: PRICE_MIN,
      priceMax: priceMax,
      currency: displayCurrency,
      vendor: '',
      inStock: null,
      sortBy: 'name-asc'
    }
    setFilters(clearedFilters)
    onFiltersApplied?.(clearedFilters)
  }, [priceMax, displayCurrency, onFiltersApplied])

  const toggleCategory = useCallback((categoryId: string) => {
    updateFilters({
      categories: filters.categories.includes(categoryId)
        ? filters.categories.filter(c => c !== categoryId)
        : [...filters.categories, categoryId]
    })
  }, [filters.categories, updateFilters])

  // ✅ Memoize computed values
  const hasActiveFilters = useMemo(() => {
    return filters.search ||
      filters.categories.length > 0 ||
      filters.priceMin !== PRICE_MIN ||
      filters.priceMax !== priceMax ||
      filters.currency !== 'USD' ||
      filters.vendor ||
      filters.inStock !== null
  }, [filters, priceMax])

  const displayRecords = filteredRecords !== undefined ? filteredRecords : totalRecords

  // Dummy implementation
  function getCategoryIcon(category: string) {
    switch (category) {
      case 'fresh-vegetables': return <Carrot className="w-4 h-4" />
      case 'fresh-fruits': return <Apple className="w-4 h-4" />
      case 'herbs-greens': return <Leaf className="w-4 h-4" />
      case 'dairy-eggs': return <Milk className="w-4 h-4" />
      case 'meat-poultry': return <Drumstick className="w-4 h-4" />
      case 'grains-cereals': return <Wheat className="w-4 h-4" />
      case 'legumes-beans': return <Cookie className="w-4 h-4" />
      case 'nuts-seeds': return <Droplet className="w-4 h-4" />
      case 'honey-sweeteners': return <Croissant className="w-4 h-4" />
      case 'preserves-pickles': return <Wheat className="w-4 h-4" />
      case 'baked-goods': return <Croissant className="w-4 h-4" />
      case 'beverages': return <Coffee className="w-4 h-4" />
      case 'farm-supplies': return <Tractor className="w-4 h-4" />
      case 'other': return <Store className="w-4 h-4" />
      default: return null
    }
  }

  // Handler for toggling section (categories collapsible)
  const toggleSection = useCallback((section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background border-l border-border relative">
      {/* Fixed Header - Top Controls */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Store className="w-5 h-5" />
          {t('filters.searchLabel')}
        </h2>
        {/* Result Count Display */}
        <p className="text-xs text-muted-foreground mt-1">
          {hasActiveFilters && filteredRecords !== undefined ? (
            <>
              {filteredRecords} {t('filters.filteredOf')} {totalRecords} {t('filters.records')}
            </>
          ) : (
            <>
              {displayRecords} {t('filters.records')}
            </>
          )}
        </p>
      </div>

      {/* Scrollable Content Area - Fills remaining vertical space */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Search Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder={t('filters.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('filters.activeFilters')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('filters.clearAll')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {filters.categories.map(category => (
                  <Badge key={category} variant="secondary" className="text-xs">
                    {t(`categories.${category}`)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => toggleCategory(category)}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                ))}
                {(filters.priceMin !== PRICE_MIN || filters.priceMax !== priceMax) && (
                  <Badge variant="secondary" className="text-xs">
                    💰 {filters.priceMin} - {filters.priceMax} {filters.currency}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => updateFilters({ priceMin: PRICE_MIN, priceMax: priceMax })}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Price Range - Always Visible Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('filters.priceRange')}</Label>
              <span className="text-xs text-muted-foreground">
                {filters.priceMin} - {filters.priceMax} {displayCurrency}
              </span>
            </div>

            {/* Price Slider (debounced) - Safe fallback values to prevent crashes */}
            <Slider
              min={PRICE_MIN}
              max={priceMax || 1000}
              step={10}
              value={[
                Math.max(PRICE_MIN, filters.priceMin ?? PRICE_MIN),
                Math.min(filters.priceMax ?? priceMax ?? 1000, priceMax ?? 1000)
              ]}
              onValueChange={handlePriceChange} // ✅ Now debounced
              className="w-full"
            />
          </div>

          <Separator />

          {/* Availability - Always Visible Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('filters.availability')}</Label>
            <div className="flex gap-2">
              <Button
                variant={filters.inStock === null ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => updateFilters({ inStock: null })}
              >
                {t('filters.all')}
              </Button>
              <Button
                variant={filters.inStock === true ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => updateFilters({ inStock: true })}
              >
                <Package className="w-4 h-4 mr-1" />
                {t('filters.inStock')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Categories - Open by Default, fills remaining space */}
          <div className="flex-1 flex flex-col min-h-0">
            <Collapsible
              open={openSections.has('categories')}
              onOpenChange={() => toggleSection('categories')}
              className="flex flex-col flex-1 min-h-0"
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3 h-auto flex-shrink-0">
                  <span className="text-sm font-medium">{t('filters.categories')}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    openSections.has('categories') && "transform rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2 pb-4">
                    {productCategories.map((category) => {
                      const isSelected = filters.categories.includes(category)
                      return (
                        <Button
                          key={category}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="justify-start h-auto p-2 w-full"
                          onClick={() => toggleCategory(category)}
                        >
                          {getCategoryIcon(category)}
                          <span className="text-xs ml-2">{t(`categories.${category}`)}</span>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
    </div>
  )
}
