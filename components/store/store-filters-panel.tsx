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
import { STORE_VENDOR_CATEGORY_IDS } from '@/constants/store-vendor-categories'
import type { Locale } from '@/i18n/shared'
import { useOptionalStore } from '@/features/store/context'
import { useOptionalCurrency } from '@/features/store/currency-context'
import { getDefaultStorePriceBounds, PRICE_MIN, type StoreFilterState } from '@/lib/store-constants'
import type { CatalogPriceBounds } from '@/lib/store-price-range'
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
  Layers,
  Cpu,
  Bot,
  Wrench,
  FileCode2,
  BookOpen,
  Users,
  Sparkles,
  LayoutTemplate,
  Briefcase,
} from 'lucide-react'

interface StoreFiltersPanelProps {
  locale: Locale
  initialFilters?: Partial<StoreFilterState>
  totalRecords?: number
  filteredRecords?: number
  onFiltersApplied?: (filters: StoreFilterState) => void
}

const productCategories = [...STORE_VENDOR_CATEGORY_IDS]

const currencies = ['USD', 'UAH', 'DAAR', 'DAARION']

interface StoreFiltersPanelPropsWithPersisted extends StoreFiltersPanelProps {
  persistedFilters?: StoreFilterState
  /** Catalog slice bounds from getStoreProducts (updated when search/category/stock changes). */
  catalogPriceBounds?: CatalogPriceBounds | null
}

export default function StoreFiltersPanel({
  locale,
  initialFilters,
  totalRecords = 0,
  filteredRecords,
  onFiltersApplied,
  persistedFilters,
  catalogPriceBounds,
}: StoreFiltersPanelPropsWithPersisted) {
  const t = useTranslations('modules.store')
  const store = useOptionalStore()
  const totalItems = store?.totalItems || 0

  const currencyContext = useOptionalCurrency()
  const displayCurrency = currencyContext?.currency || 'UAH'

  const envDefaults = getDefaultStorePriceBounds()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['categories']))
  const [sliderMax, setSliderMax] = useState(envDefaults.maxPrice)
  const priceFilterEnabled = catalogPriceBounds?.enabled ?? false

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

  // Sync slider bounds when catalog result set changes (server action on filter change)
  useEffect(() => {
    if (!catalogPriceBounds) return

    setSliderMax(catalogPriceBounds.maxPrice)

    if (!catalogPriceBounds.enabled) {
      return
    }

    setFilters((current) => {
      const next = {
        ...current,
        priceMin: catalogPriceBounds.minPrice,
        priceMax: catalogPriceBounds.maxPrice,
      }
      isApplyingFilters.current = true
      return next
    })
  }, [catalogPriceBounds])

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
      priceMax: priceFilterEnabled ? catalogPriceBounds?.maxPrice ?? sliderMax : null,
      currency: displayCurrency,
      vendor: '',
      inStock: null,
      sortBy: 'name-asc'
    }
    setFilters(clearedFilters)
    onFiltersApplied?.(clearedFilters)
  }, [priceFilterEnabled, catalogPriceBounds, sliderMax, displayCurrency, onFiltersApplied])

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
      (priceFilterEnabled &&
        (filters.priceMin !== (catalogPriceBounds?.minPrice ?? PRICE_MIN) ||
          filters.priceMax !== (catalogPriceBounds?.maxPrice ?? sliderMax))) ||
      filters.currency !== 'USD' ||
      filters.vendor ||
      filters.inStock !== null
  }, [filters, priceFilterEnabled, catalogPriceBounds, sliderMax])

  const displayRecords = filteredRecords !== undefined ? filteredRecords : totalRecords

  function getCategoryIcon(category: string) {
    switch (category) {
      case 'ring-platform':     return <Layers className="w-4 h-4" />
      case 'dev-kits':          return <Cpu className="w-4 h-4" />
      case 'ai-tools':          return <Bot className="w-4 h-4" />
      case 'expert-services':   return <Briefcase className="w-4 h-4" />
      case 'digital-templates': return <LayoutTemplate className="w-4 h-4" />
      case 'learn':             return <BookOpen className="w-4 h-4" />
      case 'community':         return <Users className="w-4 h-4" />
      case 'saas-assets':       return <Sparkles className="w-4 h-4" />
      default:                  return <Store className="w-4 h-4" />
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
    <div className="flex flex-col relative min-h-0 text-foreground">
      {/* Fixed Header - Top Controls */}
      <div className="flex-shrink-0 pb-4">
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
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4">
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
                {priceFilterEnabled &&
                  (filters.priceMin !== (catalogPriceBounds?.minPrice ?? PRICE_MIN) ||
                    filters.priceMax !== (catalogPriceBounds?.maxPrice ?? sliderMax)) && (
                  <Badge variant="secondary" className="text-xs">
                    💰 {filters.priceMin} - {filters.priceMax} {filters.currency}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() =>
                        updateFilters({
                          priceMin: catalogPriceBounds?.minPrice ?? PRICE_MIN,
                          priceMax: catalogPriceBounds?.maxPrice ?? sliderMax,
                        })
                      }
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Price Range — bounds follow catalog filters; disabled when no products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                className={cn(
                  'text-sm font-medium',
                  !priceFilterEnabled && 'text-muted-foreground',
                )}
              >
                {t('filters.priceRange')}
              </Label>
              {priceFilterEnabled && (
                <span className="text-xs text-muted-foreground">
                  {filters.priceMin} - {filters.priceMax} {displayCurrency}
                </span>
              )}
            </div>

            {!priceFilterEnabled ? (
              <p className="text-xs text-muted-foreground">{t('filters.priceRangeUnavailable')}</p>
            ) : (
              <Slider
                min={catalogPriceBounds?.minPrice ?? PRICE_MIN}
                max={catalogPriceBounds?.maxPrice ?? sliderMax}
                step={10}
                disabled={!priceFilterEnabled}
                value={[
                  Math.max(
                    catalogPriceBounds?.minPrice ?? PRICE_MIN,
                    filters.priceMin ?? PRICE_MIN,
                  ),
                  Math.min(
                    filters.priceMax ?? catalogPriceBounds?.maxPrice ?? sliderMax,
                    catalogPriceBounds?.maxPrice ?? sliderMax,
                  ),
                ]}
                onValueChange={handlePriceChange}
                className="w-full"
              />
            )}
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
