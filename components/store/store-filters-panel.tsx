'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Package,
  DollarSign,
  Star,
  User,
  Store
} from 'lucide-react'

interface StoreFilterState {
  search: string
  categories: string[]
  priceMin: string
  priceMax: string
  currency: string
  vendor: string
  rating: string
  inStock: boolean | null
  sortBy: string
}

interface StoreFiltersPanelProps {
  initialFilters?: Partial<StoreFilterState>
  resultCount?: number
  onFiltersApplied?: (filters: StoreFilterState) => void
}

// Product categories - these should match the store taxonomy
const productCategories = [
  'electronics',
  'clothing',
  'books',
  'home-garden',
  'sports-outdoors',
  'beauty-personal-care',
  'automotive',
  'toys-games',
  'health-household',
  'grocery',
  'industrial-scientific',
  'other'
]

const currencies = ['USD', 'EUR', 'UAH', 'GBP', 'DAAR', 'DAARION']
const ratings = ['4+', '3+', '2+', '1+']
const sortOptions = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'price-asc', label: 'Price (Low to High)' },
  { value: 'price-desc', label: 'Price (High to Low)' },
  { value: 'rating-desc', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest First' }
]

export default function StoreFiltersPanel({
  initialFilters,
  resultCount,
  onFiltersApplied
}: StoreFiltersPanelProps) {
  const t = useTranslations('modules.store')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['search']))
  const [filters, setFilters] = useState<StoreFilterState>({
    search: '',
    categories: [],
    priceMin: '',
    priceMax: '',
    currency: 'USD',
    vendor: '',
    rating: '',
    inStock: null,
    sortBy: 'name-asc',
    ...initialFilters
  })

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const updateFilters = (updates: Partial<StoreFilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }

  const handleClearFilters = () => {
    const clearedFilters: StoreFilterState = {
      search: '',
      categories: [],
      priceMin: '',
      priceMax: '',
      currency: 'USD',
      vendor: '',
      rating: '',
      inStock: null,
      sortBy: 'name-asc'
    }
    setFilters(clearedFilters)
    onFiltersApplied?.(clearedFilters)
  }

  const handleApplyFilters = () => {
    onFiltersApplied?.(filters)
  }

  const toggleCategory = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(c => c !== categoryId)
      : [...filters.categories, categoryId]
    updateFilters({ categories: newCategories })
  }

  const hasActiveFilters = () => {
    return filters.search ||
           filters.categories.length > 0 ||
           filters.priceMin ||
           filters.priceMax ||
           filters.currency !== 'USD' ||
           filters.vendor ||
           filters.rating ||
           filters.inStock !== null ||
           filters.sortBy !== 'name-asc'
  }

  const getCategoryTranslation = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      electronics: 'Electronics',
      clothing: 'Clothing',
      books: 'Books',
      'home-garden': 'Home & Garden',
      'sports-outdoors': 'Sports & Outdoors',
      'beauty-personal-care': 'Beauty & Personal Care',
      automotive: 'Automotive',
      'toys-games': 'Toys & Games',
      'health-household': 'Health & Household',
      grocery: 'Grocery',
      'industrial-scientific': 'Industrial & Scientific',
      other: 'Other'
    }
    return categoryMap[category] || category
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-sm font-medium">Search Products</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search by name, description..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters() && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active Filters</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.categories.map(category => (
              <Badge key={category} variant="secondary" className="text-xs">
                {getCategoryTranslation(category)}
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
            {(filters.priceMin || filters.priceMax) && (
              <Badge variant="secondary" className="text-xs">
                💰 {filters.priceMin || '0'} - {filters.priceMax || '∞'} {filters.currency}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => updateFilters({ priceMin: '', priceMax: '' })}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
            {filters.rating && (
              <Badge variant="secondary" className="text-xs">
                ⭐ {filters.rating} stars
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => updateFilters({ rating: '' })}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Filter Sections */}
      <div className="space-y-3">
        {/* Categories */}
        <Collapsible
          open={openSections.has('categories')}
          onOpenChange={() => toggleSection('categories')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Categories</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('categories') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {productCategories.map((category) => {
                const isSelected = filters.categories.includes(category)
                return (
                  <Button
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start h-auto p-2"
                    onClick={() => toggleCategory(category)}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    <span className="text-xs">{getCategoryTranslation(category)}</span>
                  </Button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Price Range */}
        <Collapsible
          open={openSections.has('price')}
          onOpenChange={() => toggleSection('price')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Price Range</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('price') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-3">
            {/* Currency Selector */}
            <div>
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select
                value={filters.currency}
                onValueChange={(value) => updateFilters({ currency: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.priceMin}
                  onChange={(e) => updateFilters({ priceMin: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={filters.priceMax}
                  onChange={(e) => updateFilters({ priceMax: e.target.value })}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Rating Filter */}
        <Collapsible
          open={openSections.has('rating')}
          onOpenChange={() => toggleSection('rating')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Rating</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('rating') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Select
              value={filters.rating}
              onValueChange={(value) => updateFilters({ rating: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any rating</SelectItem>
                {ratings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {rating} stars and above
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Availability */}
        <Collapsible
          open={openSections.has('availability')}
          onOpenChange={() => toggleSection('availability')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Availability</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('availability') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <div className="space-y-2">
              <Button
                variant={filters.inStock === true ? "default" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={() => updateFilters({ inStock: filters.inStock === true ? null : true })}
              >
                <Package className="w-4 h-4 mr-2" />
                In Stock Only
              </Button>
              <Button
                variant={filters.inStock === false ? "default" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={() => updateFilters({ inStock: filters.inStock === false ? null : false })}
              >
                <Package className="w-4 h-4 mr-2" />
                Out of Stock
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Sort Options */}
        <Collapsible
          open={openSections.has('sort')}
          onOpenChange={() => toggleSection('sort')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Sort By</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('sort') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilters({ sortBy: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Vendor Upsell Section */}
      <div className="border-t pt-4">
        <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-sm">Become a Vendor</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Sell your products on Ring Platform and reach thousands of customers.
          </p>
          <Button size="sm" className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
            <Store className="w-3 h-3 mr-1" />
            Start Selling
          </Button>
        </div>
      </div>

      {/* Apply Filters Button */}
      <Button className="w-full" onClick={handleApplyFilters}>
        <Filter className="w-4 h-4 mr-2" />
        Apply Filters
        {resultCount !== undefined && (
          <Badge variant="secondary" className="ml-2">
            {resultCount}
          </Badge>
        )}
      </Button>
    </div>
  )
}
