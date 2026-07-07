'use client'

// Core React/Next imports: using React 19+ API features (useTransition, use, etc.)
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
import { useOptionalStoreCurrency } from '@/features/store/currency-context'
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

// Props interface for component
interface StoreFiltersPanelProps {
  locale: Locale
  initialFilters?: Partial<StoreFilterState>
  totalRecords?: number
  filteredRecords?: number
  onFiltersApplied?: (filters: StoreFilterState) => void
}

// Categories imported from constants - extendable for new categories
const productCategories = [...STORE_VENDOR_CATEGORY_IDS]

// MOCK CODE, TODO: Replace currencies mock with fetched currencies from backend/currencies resource in the future.
// Steps:
// 1. Use API request/hook to get allowed/available currencies.
// 2. Replace with fetched list of currency codes below.
const currencies = ['USD', 'UAH', 'DAAR', 'DAARION']

// Props extended with persisted and catalog bounds state
interface StoreFiltersPanelPropsWithPersisted extends StoreFiltersPanelProps {
  persistedFilters?: StoreFilterState
  /** Catalog slice bounds from getStoreProducts (updated when search/category/stock changes). */
  catalogPriceBounds?: CatalogPriceBounds | null
}

// Main component for store filter panel, managing all local state and notification of filter changes
export default function StoreFiltersPanel({
  locale,
  initialFilters,
  totalRecords = 0,
  filteredRecords,
  onFiltersApplied,
  persistedFilters,
  catalogPriceBounds,
}: StoreFiltersPanelPropsWithPersisted) {
  // Next-intl translation object
  const t = useTranslations('modules.store')

  // Get context for store data and total items
  const store = useOptionalStore()
  const totalItems = store?.totalItems || 0

  // Get currency, fallback to 'UAH'
  const storeCurrencyContext = useOptionalStoreCurrency()
  const displayCurrency = storeCurrencyContext?.currency || 'UAH'

  // Default price bounds from env/store config
  const envDefaults = getDefaultStorePriceBounds()

  // Track which filter sections are open (collapsible panels)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['categories']))
  // Upper bound for price slider (syncs to category selection)
  const [sliderMax, setSliderMax] = useState(envDefaults.maxPrice)
  // Whether the price filter is currently enabled (products available)
  const priceFilterEnabled = catalogPriceBounds?.enabled ?? false

  // Ref for tracking if filters are being applied, prevents effect loops
  const isApplyingFilters = useRef(false)
  // Tracks timeout for debounced slider input
  const priceChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // React 19: useTransition for non-blocking updates
  const [isPending, startTransition] = useTransition()

  // State for active filters, initialized from props (persisted or initial)
  // TODO: Use React 19 use() hook for server-initialized state if possible.
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

  // Utility to update filter state with transition (React 19 pattern)
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

  // Notify parent when filters actually change (React 19 pattern: trigger via useEffect, not inside setState)
  useEffect(() => {
    if (isApplyingFilters.current && onFiltersApplied) {
      onFiltersApplied(filters)
      isApplyingFilters.current = false
    }
  }, [filters, onFiltersApplied])

  // When catalog result set changes (from server action or parent props), sync [sliderMax] and [filters.priceMin/max]
  useEffect(() => {
    if (!catalogPriceBounds) return

    setSliderMax(catalogPriceBounds.maxPrice)

    // Only update filter bounds if enabled (don't overwrite if unavailable)
    if (!catalogPriceBounds.enabled) {
      return
    }

    setFilters((current) => {
      const next = {
        ...current,
        priceMin: catalogPriceBounds.minPrice,
        priceMax: catalogPriceBounds.maxPrice,
      }
      isApplyingFilters.current = true // signal for parent update
      return next
    })
  }, [catalogPriceBounds])

  // Handler for moving price slider, updates state immediately and debounces API/filter notification
  const handlePriceChange = useCallback((values: number[]) => {
    // Clear previous debounce if still active
    if (priceChangeTimeoutRef.current) {
      clearTimeout(priceChangeTimeoutRef.current)
    }

    // Optimistically update slider UI (local state)
    setFilters(current => ({
      ...current,
      priceMin: values[0],
      priceMax: values[1]
    }))

    // Debounce filter notification (avoid sending every minor slider move)
    priceChangeTimeoutRef.current = setTimeout(() => {
      updateFilters({ priceMin: values[0], priceMax: values[1] })
    }, 300) // 300ms debounce
  }, [updateFilters])

  // Update currency in filter state if displayCurrency from context changes (e.g. user switches)
  useEffect(() => {
    if (displayCurrency !== filters.currency) {
      updateFilters({ currency: displayCurrency })
    }
  }, [displayCurrency, filters.currency, updateFilters])

  // Cleanup price slider debounce on component unmount
  useEffect(() => {
    return () => {
      if (priceChangeTimeoutRef.current) {
        clearTimeout(priceChangeTimeoutRef.current)
      }
    }
  }, [])

  // Reset all filters and immediately push to parent
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

  // Toggle selection of a category chip (add/remove to filters.categories)
  // TODO: If category list is large, replace with controlled virtual list component for efficiency
  const toggleCategory = useCallback((categoryId: string) => {
    updateFilters({
      categories: filters.categories.includes(categoryId)
        ? filters.categories.filter(c => c !== categoryId)
        : [...filters.categories, categoryId]
    })
  }, [filters.categories, updateFilters])

  // Memoized flag to quickly check if ANY filter is active (for UI bages/buttons)
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

  // Which record count to show (filtered if defined, else total)
  const displayRecords = filteredRecords !== undefined ? filteredRecords : totalRecords

  // Category icon selector - extend here for new icons/types
  // MOCK CODE, TODO: Abstract icon assignment to configuration object if more categories added.
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

  // Section (collapsible) open/close handler for multi-section support
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

  // TODO: Replace <div> layout with <section><header><main> for better semantics and accessibility.

  return (
    <div className="flex flex-col relative min-h-0 text-foreground">
      {/* Fixed Header - filter label and count */}
      <div className="flex-shrink-0 pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Store className="w-5 h-5" />
          {t('filters.searchLabel')}
        </h2>
        {/* Display filtered/total result counts */}
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

      {/* Scrollable area for filter controls (fills available space) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4">
          {/* Search Input (always visible) */}
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

          {/* Display active filter chips & clear all button */}
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
              {/* Filter chips: categories and price, with remove buttons */}
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
                    {/* TODO: Intl.NumberFormat using displayCurrency for proper formatting */}
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

          {/* Price filtering, with slider input and min/max display */}
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
            {/* Show price slider only if enabled; else, explain why unavailable */}
            {!priceFilterEnabled ? (
              <p className="text-xs text-muted-foreground">{t('filters.priceRangeUnavailable')}</p>
            ) : (
              <Slider
                min={catalogPriceBounds?.minPrice ?? PRICE_MIN}
                max={catalogPriceBounds?.maxPrice ?? sliderMax}
                step={10}
                disabled={!priceFilterEnabled}
                value={[
                  // Bound to filter state with min/max enforced
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

          {/* Toggle for product availability (all/in-stock only) */}
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

          {/* Categories filter with collapsible section (open by default) */}
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
                  {/* TODO: Virtualized list if productCategories is very large */}
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
