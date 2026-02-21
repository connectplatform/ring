'use client'

import React, { useState, useCallback, useEffect, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import StoreFiltersPanel from '@/components/store/store-filters-panel'
import FloatingButtons from '@/components/store/floating-buttons'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import VendorCTACard from '@/components/vendor/vendor-cta-card'
import type { Locale } from '@/i18n-config'
import { DEFAULT_STORE_FILTERS, type StoreFilterState } from '@/lib/store-constants'

const STORAGE_KEY = 'ring-store-filters'
const STORAGE_VERSION = 'v1'

interface StoreWrapperProps {
  children: React.ReactElement<any>
  locale: Locale
}

export default function StoreWrapper({ children, locale }: StoreWrapperProps) {
  const currentLocale = useLocale()
  const t = useTranslations('modules.store')
  
  const [totalRecords, setTotalRecords] = useState(0)
  const [filteredRecords, setFilteredRecords] = useState<number | undefined>(undefined)
  const [filters, setFilters] = useState<StoreFilterState>(DEFAULT_STORE_FILTERS)
  const [isHydrated, setIsHydrated] = useState(false)
  const [priceRange, setPriceRange] = useState<{ minPrice: number; maxPrice: number } | null>(null)

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  // Load filters from localStorage on mount (persistent by default)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        
        // Validate version and freshness (24h expiry)
        if (data.version === STORAGE_VERSION && 
            Date.now() - data.timestamp < 24 * 60 * 60 * 1000 &&
            data.filters) {
          console.log('💾 Restored filters from localStorage:', data.filters)
          setFilters(data.filters)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch (err) {
      console.warn('Failed to load filters:', err)
      localStorage.removeItem(STORAGE_KEY)
    }
    
    setIsHydrated(true)
  }, [])

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        filters,
        timestamp: Date.now()
      }))
      console.log('💾 Saved filters to localStorage')
    } catch (err) {
      console.warn('Failed to save filters:', err)
    }
  }, [filters, isHydrated])

  const handleCountsUpdate = useCallback((total: number, filtered?: number) => {
    setTotalRecords(total)
    setFilteredRecords(filtered)
  }, [])

  const handlePriceRangeUpdate = useCallback((range: { minPrice: number; maxPrice: number }) => {
    setPriceRange(range)
    console.log('💰 Price range updated:', range)
  }, [])

  const handleFiltersChange = useCallback((newFilters: StoreFilterState) => {
    startTransition(() => {
      setFilters(newFilters)
    })
  }, [startTransition])

  const handleSortChange = useCallback((sortBy: string) => {
    console.log('⇅ New sort order:', sortBy)
    startTransition(() => {
      setFilters(prev => ({ ...prev, sortBy }))
    })
  }, [startTransition])

  const childrenWithProps = React.cloneElement(children, {
    onCountsUpdate: handleCountsUpdate,
    onPriceRangeUpdate: handlePriceRangeUpdate,
    filters: filters
  })

  // Wait for hydration (prevents flash of wrong state)
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout - Flex-based 3-column layout like Cart/Checkout wrappers */}
      <div className="hidden lg:flex gap-6 min-h-screen" key={`desktop-${currentLocale}`}>
        {/* Left Sidebar - Navigation (280px fixed width) */}
        <div className="w-[280px] flex-shrink-0">
          <DesktopSidebar key={`sidebar-${currentLocale}`} />
        </div>

        {/* Main Content Area - Store Products */}
        <div className="flex-1 min-w-0 py-8">
          <div className="relative">
            {childrenWithProps}
            {/* FloatingButtons handles all button positioning for desktop */}
            <FloatingButtons 
              key={`floating-${currentLocale}`} 
              locale={locale}
              currentSort={filters.sortBy}
              onSortChange={handleSortChange}
            />
          </div>
        </div>

        {/* Right Sidebar - Store Controls & Filters (320px) */}
        <div className="w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <StoreFiltersPanel
              locale={locale}
              totalRecords={totalRecords}
              filteredRecords={filteredRecords}
              onFiltersApplied={handleFiltersChange}
              persistedFilters={filters}
              priceRangeFromDB={priceRange}
            />
            
            {/* Vendor CTA - Show to non-vendor users */}
            <div className="mt-6">
              <VendorCTACard />
            </div>
          </div>
        </div>
      </div>

      {/* iPad Layout - Flex-based with sidebar + content, hidden on mobile and desktop */}
      <div className="hidden md:flex lg:hidden gap-6 min-h-screen" key={`ipad-${currentLocale}`}>
        {/* Left Sidebar - Navigation (280px) */}
        <div className="w-[280px] flex-shrink-0">
          <DesktopSidebar key={`sidebar-ipad-${currentLocale}`} />
        </div>

        {/* Main Content - Store Products */}
        <div className="flex-1 min-w-0 py-8 px-4">
          <div className="relative">
            {childrenWithProps}
          </div>

          {/* Floating Buttons (iPad) - All three buttons grouped, higher position */}
          <FloatingButtons 
            key={`floating-ipad-${currentLocale}`} 
            locale={locale}
            currentSort={filters.sortBy}
            onSortChange={handleSortChange}
          />

          {/* Floating Sidebar Toggle for Filters (iPad only) */}
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <div className="space-y-4">
              <StoreFiltersPanel
                locale={locale}
                totalRecords={totalRecords}
                filteredRecords={filteredRecords}
                onFiltersApplied={handleFiltersChange}
                persistedFilters={filters}
                priceRangeFromDB={priceRange}
              />
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>

      {/* Mobile Layout - Single column, hidden on iPad and desktop */}
      <div className="md:hidden px-4" key={`mobile-${currentLocale}`}>
        <div className="relative">
          {childrenWithProps}
        </div>

        {/* Floating Buttons (Mobile) - All three buttons grouped, higher position */}
        <FloatingButtons 
          key={`floating-mobile-${currentLocale}`} 
          locale={locale}
          currentSort={filters.sortBy}
          onSortChange={handleSortChange}
        />

        {/* Floating Sidebar Toggle for Filters (Mobile only) */}
        <FloatingSidebarToggle key={`toggle-mobile-${currentLocale}`}>
          <div className="space-y-4">
            <StoreFiltersPanel
              locale={locale}
              totalRecords={totalRecords}
              filteredRecords={filteredRecords}
              onFiltersApplied={handleFiltersChange}
              persistedFilters={filters}
              priceRangeFromDB={priceRange}
            />
          </div>
        </FloatingSidebarToggle>
      </div>
    </div>
  )
}
