'use client'

import React from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, X, ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslation } from '@/node_modules/react-i18next'
import { applyFilters, FilterFormState } from '@/app/actions/filters'

interface FilterFormProps {
  onFiltersChange?: (filters: ActiveFilters) => void
  initialFilters?: ActiveFilters
  className?: string
}

interface ActiveFilters {
  category?: string
  location?: string
  type?: string
  priceRange?: [number, number]
  tags?: string[]
  dateRange?: string
  sortBy?: string
}

interface FilterOption {
  label: string
  value: string
  count?: number
}

function ApplyButton() {
  const { pending } = useFormStatus()
  const { t } = useTranslation()
  
  return (
    <Button 
      type="submit" 
      className="w-full"
      disabled={pending}
    >
      {pending ? (
        <>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
          />
          {t('applyingFilters') || 'Applying...'}
        </>
      ) : (
        <>
          <Filter className="mr-2 h-4 w-4" />
          {t('applyFilters') || 'Apply Filters'}
        </>
      )}
    </Button>
  )
}

function ActiveFiltersList({ 
  filters, 
  onRemoveFilter 
}: { 
  filters: ActiveFilters
  onRemoveFilter: (key: keyof ActiveFilters, value?: string) => void 
}) {
  const { t } = useTranslation()
  const activeItems: { key: keyof ActiveFilters; label: string; value?: string }[] = []
  
  if (filters.category) {
    activeItems.push({ key: 'category', label: filters.category })
  }
  if (filters.location) {
    activeItems.push({ key: 'location', label: filters.location })
  }
  if (filters.type) {
    activeItems.push({ key: 'type', label: filters.type })
  }
  if (filters.tags) {
    filters.tags.forEach(tag => {
      activeItems.push({ key: 'tags', label: tag, value: tag })
    })
  }
  if (filters.dateRange) {
    activeItems.push({ key: 'dateRange', label: filters.dateRange })
  }
  
  if (activeItems.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t('activeFilters') || 'Active Filters'}:
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeItems.map((item, index) => (
          <motion.div
            key={`${item.key}-${item.value || item.label}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1"
            >
              {item.label}
              <button
                type="button"
                onClick={() => onRemoveFilter(item.key, item.value)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-2 w-2" />
              </button>
            </Badge>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function FilterSection({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto">
          <span className="font-medium">{title}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          {children}
        </motion.div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * FilterForm component
 * Dynamic filtering with React 19 features and optimistic updates
 * 
 * Features:
 * - useActionState() for filter state management
 * - useOptimistic() for instant UI feedback
 * - useFormStatus() for loading states
 * - Server Actions for filter processing
 * - Collapsible filter sections
 * - Active filter management
 * 
 * @param {FilterFormProps} props - Component props
 * @returns JSX.Element
 */
export default function FilterForm({ 
  onFiltersChange, 
  initialFilters = {}, 
  className = '' 
}: FilterFormProps) {
  const { t } = useTranslation()
  const [filters, setFilters] = React.useState<ActiveFilters>(initialFilters)
  
  // Optimistic updates for instant UI feedback
  const [optimisticFilters, addOptimisticFilter] = useOptimistic(
    filters,
    (state: ActiveFilters, newFilter: Partial<ActiveFilters>) => ({
      ...state,
      ...newFilter
    })
  )

  const [state, formAction] = useActionState<FilterFormState | null, FormData>(
    applyFilters,
    null
  )

  // Category options
  const categoryOptions: FilterOption[] = [
    { label: 'Technology', value: 'technology', count: 42 },
    { label: 'Healthcare', value: 'healthcare', count: 28 },
    { label: 'Education', value: 'education', count: 19 },
    { label: 'Finance', value: 'finance', count: 15 },
    { label: 'Retail', value: 'retail', count: 23 }
  ]

  // Location options
  const locationOptions: FilterOption[] = [
    { label: 'Cherkasy', value: 'cherkasy', count: 67 },
    { label: 'Kyiv', value: 'kyiv', count: 45 },
    { label: 'Remote', value: 'remote', count: 38 },
    { label: 'Lviv', value: 'lviv', count: 22 }
  ]

  const handleFilterChange = (key: keyof ActiveFilters, value: any) => {
    const newFilters = { ...optimisticFilters, [key]: value }
    
    // Apply optimistic update immediately
    addOptimisticFilter({ [key]: value })
    
    // Update actual state
    setFilters(newFilters)
    
    // Notify parent component
    if (onFiltersChange) {
      onFiltersChange(newFilters)
    }
  }

  const handleRemoveFilter = (key: keyof ActiveFilters, value?: string) => {
    let newFilters = { ...optimisticFilters }
    
    if (key === 'tags' && value) {
      newFilters.tags = newFilters.tags?.filter(tag => tag !== value)
      if (newFilters.tags?.length === 0) {
        delete newFilters.tags
      }
    } else {
      delete newFilters[key]
    }
    
    setFilters(newFilters)
    addOptimisticFilter(newFilters)
    
    if (onFiltersChange) {
      onFiltersChange(newFilters)
    }
  }

  const clearAllFilters = () => {
    const emptyFilters = {}
    setFilters(emptyFilters)
    addOptimisticFilter(emptyFilters)
    
    if (onFiltersChange) {
      onFiltersChange(emptyFilters)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    
    Object.entries(optimisticFilters).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value))
        } else {
          formData.append(key, String(value))
        }
      }
    })
    
    formAction(formData)
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters') || 'Filters'}
          </CardTitle>
          {Object.keys(optimisticFilters).length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('clearAll') || 'Clear All'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ActiveFiltersList 
          filters={optimisticFilters} 
          onRemoveFilter={handleRemoveFilter} 
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Filter */}
          <FilterSection title={t('category') || 'Category'} defaultOpen>
            <Select 
              value={optimisticFilters.category} 
              onValueChange={(value) => handleFilterChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory') || 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {option.count && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {option.count}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Location Filter */}
          <FilterSection title={t('location') || 'Location'}>
            <Select 
              value={optimisticFilters.location} 
              onValueChange={(value) => handleFilterChange('location', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectLocation') || 'Select location'} />
              </SelectTrigger>
              <SelectContent>
                {locationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                      {option.count && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {option.count}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Type Filter */}
          <FilterSection title={t('type') || 'Type'}>
            <div className="space-y-2">
              {['entity', 'opportunity'].map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={optimisticFilters.type === type}
                    onCheckedChange={(checked: boolean) => 
                      handleFilterChange('type', checked ? type : undefined)
                    }
                  />
                  <Label htmlFor={type} className="capitalize">
                    {t(type) || type}
                  </Label>
                </div>
              ))}
            </div>
          </FilterSection>

          {/* Date Range Filter */}
          <FilterSection title={t('dateRange') || 'Date Range'}>
            <Select 
              value={optimisticFilters.dateRange} 
              onValueChange={(value) => handleFilterChange('dateRange', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectDateRange') || 'Select date range'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </FilterSection>

          <ApplyButton />
        </form>

        {/* Show filter results count */}
        {state?.success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-muted/50 rounded-md"
          >
            <p className="text-sm text-muted-foreground">
              {state.message || `Found ${state.resultCount || 0} results`}
            </p>
          </motion.div>
        )}

        {/* Error message */}
        {state?.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
          >
            <p className="text-sm text-destructive">{state.error}</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
} 