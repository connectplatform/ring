'use client'

import { useState, useOptimistic, useTransition, useCallback } from 'react'
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
  Briefcase,
  HandHeart,
  Users2,
  GraduationCap,
  Package,
  Calendar as CalendarIcon,
  MapPin,
  DollarSign,
  Clock,
  Filter,
  X,
  ChevronDown,
  Search,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface FilterState {
  search: string
  types: string[]
  categories: string[]
  location: string
  budgetMin: string
  budgetMax: string
  currency: string
  priority: string
  deadline: string
  entityVerified: boolean | null
  hasDeadline: boolean | null
}

interface OpportunitiesFiltersPanelProps {
  initialFilters?: Partial<FilterState>
  resultCount?: number
  onFiltersApplied?: (filters: FilterState) => void
  // React 19 optimistic updates
  opportunities?: any[]
  onOptimisticUpdate?: (optimisticOpportunities: any[]) => void
}

const opportunityTypes = [
  { id: 'ring_customization', icon: Package, color: 'bg-gradient-to-r from-violet-500 to-purple-500', label: 'Ring Customization' },
  { id: 'request', icon: HandHeart, color: 'bg-blue-500', label: 'Technology Request' },
  { id: 'offer', icon: Briefcase, color: 'bg-green-500', label: 'Technology Offer' },
  { id: 'mentorship', icon: GraduationCap, color: 'bg-indigo-500', label: 'Developer CV' }
]

const categories = [
  'technology',
  'business',
  'education',
  'healthcare',
  'finance',
  'platform_deployment',
  'module_development',
  'branding_customization',
  'database_migration',
  'localization',
  'payment_integration',
  'smart_contracts',
  'ai_customization',
  'token_economics',
  'documentation_training',
  'other'
]

const priorities = [
  { id: 'urgent', icon: AlertTriangle, label: 'Urgent', color: 'text-red-600' },
  { id: 'normal', icon: CheckCircle, label: 'Normal', color: 'text-gray-600' },
  { id: 'low', icon: Clock, label: 'Low', color: 'text-gray-500' }
]

const currencies = ['USD', 'EUR', 'UAH', 'GBP']

export default function OpportunitiesFiltersPanel({
  initialFilters,
  resultCount,
  onFiltersApplied,
  opportunities = [],
  onOptimisticUpdate
}: OpportunitiesFiltersPanelProps) {
  const t = useTranslations('modules.opportunities')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['types']))

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  // React 19 useOptimistic for instant filter feedback
  const [optimisticOpportunities, addOptimisticFilter] = useOptimistic(
    opportunities,
    (currentOpportunities: any[], newFilters: FilterState) => {
      // Apply filters client-side for instant feedback
      return currentOpportunities.filter(opp => matchesFilters(opp, newFilters))
    }
  )

  // Helper function to check if opportunity matches filters
  const matchesFilters = (opportunity: any, filters: FilterState): boolean => {
    // Search filter
    if (filters.search && !opportunity.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !opportunity.briefDescription.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }

    // Type filter
    if (filters.types.length > 0 && !filters.types.includes(opportunity.type)) {
      return false
    }

    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(opportunity.category)) {
      return false
    }

    // Location filter
    if (filters.location && !opportunity.location.toLowerCase().includes(filters.location.toLowerCase())) {
      return false
    }

    // Budget filter
    if (filters.budgetMin && opportunity.budget?.min < parseInt(filters.budgetMin)) {
      return false
    }
    if (filters.budgetMax && opportunity.budget?.max > parseInt(filters.budgetMax)) {
      return false
    }

    return true
  }
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    types: [],
    categories: [],
    location: '',
    budgetMin: '',
    budgetMax: '',
    currency: 'USD',
    priority: '',
    deadline: '',
    entityVerified: null,
    hasDeadline: null,
    ...initialFilters
  })

  // Get translated type name
  const getTypeTranslation = (type: string) => {
    const typeMap: { [key: string]: string } = {
      ring_customization: t('ring_customization') || 'Ring Customization',
      request: t('request') || 'Technology Request',
      offer: t('offer') || 'Technology Offer',
      mentorship: t('mentorship') || 'Developer CV'
    }
    return typeMap[type] || type
  }

  // Get translated category name
  const getCategoryTranslation = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      technology: t('technology'),
      business: t('business'),
      education: t('education'),
      healthcare: t('healthcare'),
      finance: t('finance'),
      platform_deployment: t('platform_deployment'),
      module_development: t('module_development'),
      branding_customization: t('branding_customization'),
      database_migration: t('database_migration'),
      localization: t('localization'),
      payment_integration: t('payment_integration'),
      smart_contracts: t('smart_contracts'),
      ai_customization: t('ai_customization'),
      token_economics: t('token_economics'),
      documentation_training: t('documentation_training'),
      other: t('other')
    }
    return categoryMap[category] || category
  }

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

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    startTransition(() => {
    setFilters(prev => ({ ...prev, ...updates }))
    })
  }, [startTransition])

  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
      search: '',
      types: [],
      categories: [],
      location: '',
      budgetMin: '',
      budgetMax: '',
      currency: 'USD',
      priority: '',
      deadline: '',
      entityVerified: null,
      hasDeadline: null
    }
    setFilters(clearedFilters)
    onFiltersApplied?.(clearedFilters)
  }

  const handleApplyFilters = () => {
    // React 19: Show instant optimistic update
    addOptimisticFilter(filters)

    // Notify parent of optimistic update
    if (onOptimisticUpdate && opportunities.length > 0) {
      const filtered = opportunities.filter(opp => matchesFilters(opp, filters))
      onOptimisticUpdate(filtered)
    }

    // Then apply real filters
    onFiltersApplied?.(filters)
  }

  const toggleType = (typeId: string) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId]
    updateFilters({ types: newTypes })
  }

  const toggleCategory = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(c => c !== categoryId)
      : [...filters.categories, categoryId]
    updateFilters({ categories: newCategories })
  }

  const hasActiveFilters = () => {
    return filters.search ||
           filters.types.length > 0 ||
           filters.categories.length > 0 ||
           filters.location ||
           filters.budgetMin ||
           filters.budgetMax ||
           filters.currency !== 'USD' ||
           filters.priority ||
           filters.deadline ||
           filters.entityVerified !== null ||
           filters.hasDeadline !== null
  }


  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-sm font-medium">Search Opportunities</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder={t('searchOpportunities')}
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
            {filters.types.map(type => (
              <Badge key={type} variant="secondary" className="text-xs">
                {getTypeTranslation(type)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => toggleType(type)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
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
            {filters.location && (
              <Badge variant="secondary" className="text-xs">
                📍 {filters.location}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => updateFilters({ location: '' })}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
            {(filters.budgetMin || filters.budgetMax) && (
              <Badge variant="secondary" className="text-xs">
                💰 {filters.budgetMin || '0'} - {filters.budgetMax || '∞'} {filters.currency}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => updateFilters({ budgetMin: '', budgetMax: '' })}
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
        {/* Opportunity Types */}
        <Collapsible
          open={openSections.has('types')}
          onOpenChange={() => toggleSection('types')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Opportunity Types</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('types') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {opportunityTypes.map((type) => {
                const IconComponent = type.icon
                const isSelected = filters.types.includes(type.id)
                return (
                  <Button
                    key={type.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start h-auto p-2"
                    onClick={() => toggleType(type.id)}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full mr-2",
                      type.color,
                      isSelected && "ring-2 ring-white ring-offset-1"
                    )} />
                    <IconComponent className="w-4 h-4 mr-2" />
                    <span className="text-xs">{getTypeTranslation(type.id)}</span>
                  </Button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

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
            <div className="grid grid-cols-1 gap-2">
              {categories.map((category) => {
                const isSelected = filters.categories.includes(category)
                return (
                  <Button
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start h-auto p-2"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="text-xs">{getCategoryTranslation(category)}</span>
                  </Button>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Location Filter */}
        <Collapsible
          open={openSections.has('location')}
          onOpenChange={() => toggleSection('location')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Location</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('location') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Input
              placeholder="Enter city or country"
              value={filters.location}
              onChange={(e) => updateFilters({ location: e.target.value })}
            />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Budget Range */}
        <Collapsible
          open={openSections.has('budget')}
          onOpenChange={() => toggleSection('budget')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Budget Range</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('budget') && "transform rotate-180"
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
                  value={filters.budgetMin}
                  onChange={(e) => updateFilters({ budgetMin: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={filters.budgetMax}
                  onChange={(e) => updateFilters({ budgetMax: e.target.value })}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Priority Filter */}
        <Collapsible
          open={openSections.has('priority')}
          onOpenChange={() => toggleSection('priority')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">Priority</span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('priority') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Select
              value={filters.priority}
              onValueChange={(value) => updateFilters({ priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any priority</SelectItem>
                {priorities.map((priority) => {
                  const IconComponent = priority.icon
                  return (
                    <SelectItem key={priority.id} value={priority.id}>
                      <div className="flex items-center gap-2">
                        <IconComponent className={cn("w-4 h-4", priority.color)} />
                        {priority.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      {/* Results Count - Entity Pattern */}
      {resultCount !== undefined && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {t('showingResults', { count: resultCount })}
          </span>
          
          {hasActiveFilters() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('activeFilters') || 'Active filters'}:</span>
              <Badge variant="secondary" className="text-xs">
                {[
                  filters.types.length > 0 && `${filters.types.length} ${t('filters.types') || 'types'}`,
                  filters.categories.length > 0 && `${filters.categories.length} ${t('filters.categories') || 'categories'}`,
                  filters.location && t('filters.location') || 'location',
                  filters.priority && t('filters.priority') || 'priority',
                  filters.budgetMin && t('filters.budget') || 'budget'
                ].filter(Boolean).join(', ')}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
