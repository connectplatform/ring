"use client"

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

interface AdvancedFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClearFilters: () => void
  resultCount?: number
}

const opportunityTypes = [
  { id: 'offer', icon: Briefcase, color: 'bg-blue-500', label: 'Offer' },
  { id: 'request', icon: HandHeart, color: 'bg-green-500', label: 'Request' },
  { id: 'partnership', icon: Users2, color: 'bg-purple-500', label: 'Partnership' },
  { id: 'volunteer', icon: HandHeart, color: 'bg-orange-500', label: 'Volunteer' },
  { id: 'mentorship', icon: GraduationCap, color: 'bg-indigo-500', label: 'Mentorship' },
  { id: 'resource', icon: Package, color: 'bg-teal-500', label: 'Resource' },
  { id: 'event', icon: CalendarIcon, color: 'bg-pink-500', label: 'Event' },
  { id: 'ring_customization', icon: Package, color: 'bg-gradient-to-r from-violet-500 to-purple-500', label: 'Ring Customization' }
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

const AdvancedFilters = ({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  resultCount 
}: AdvancedFiltersProps) => {
  const t = useTranslations('modules.opportunities')
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Get translated type name
  const getTypeTranslation = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'offer': t('offer'),
      'request': t('request'),
      'partnership': t('partnership'),
      'volunteer': t('volunteer'),
      'mentorship': t('mentorship'),
      'resource': t('resource'),
      'event': t('event'),
      'ring_customization': t('ring_customization')
    }
    return typeMap[type] || type
  }
  
  // Get translated category name
  const getCategoryTranslation = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'technology': t('technology'),
      'business': t('business'),
      'education': t('education'),
      'healthcare': t('healthcare'),
      'finance': t('finance'),
      'platform_deployment': t('platform_deployment'),
      'module_development': t('module_development'),
      'branding_customization': t('branding_customization'),
      'database_migration': t('database_migration'),
      'localization': t('localization'),
      'payment_integration': t('payment_integration'),
      'smart_contracts': t('smart_contracts'),
      'ai_customization': t('ai_customization'),
      'token_economics': t('token_economics'),
      'documentation_training': t('documentation_training'),
      'other': t('other')
    }
    return categoryMap[category] || category
  }
  
  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }
  
  const toggleType = (typeId: string) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId]
    updateFilter('types', newTypes)
  }
  
  const toggleCategory = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(c => c !== categoryId)
      : [...filters.categories, categoryId]
    updateFilter('categories', newCategories)
  }
  
  const hasActiveFilters = 
    filters.search ||
    filters.types.length > 0 ||
    filters.categories.length > 0 ||
    filters.location ||
    filters.budgetMin ||
    filters.budgetMax ||
    (filters.priority && filters.priority !== 'all') ||
    (filters.deadline && filters.deadline !== 'all') ||
    filters.entityVerified !== null ||
    filters.hasDeadline !== null

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      {/* Search Bar with Integrated Blue Button */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchOpportunities')}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                // Trigger search on Enter
              }
            }}
            className="pl-10 pr-32 h-12 text-base"
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            {filters.search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateFilter('search', '')}
                className="h-10 w-10 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-10 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              disabled={!filters.search.trim()}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="gap-2 h-12">
                <Filter className="h-4 w-4" />
                {t('filters')}
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-12">
              <X className="h-4 w-4 mr-1" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {/* Opportunity Types - Always Visible */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t('type')}</Label>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {opportunityTypes.map((type) => {
            const Icon = type.icon
            const isSelected = filters.types.includes(type.id)
            
            return (
              <Button
                key={type.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => toggleType(type.id)}
                className={cn(
                  "gap-2 transition-all",
                  isSelected && "shadow-sm"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full flex items-center justify-center", type.color)}>
                  <Icon className="h-2 w-2 text-white" />
                </div>
                {getTypeTranslation(type.id)}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Advanced Filters - Collapsible */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent className="space-y-4">
          <Separator />
          
          {/* Categories */}
          <div>
            <Label className="text-sm font-medium mb-3 block">{t('category')}</Label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {categories.map((category) => {
                const isSelected = filters.categories.includes(category)
                
                return (
                  <Button
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(category)}
                  >
                    {getCategoryTranslation(category)}
                  </Button>
                )
              })}
            </div>
          </div>
          
          {/* Location and Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t('location')}
              </Label>
              <Input
                placeholder={t('locationPlaceholder')}
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t('budget')}
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('min')}
                  value={filters.budgetMin}
                  onChange={(e) => updateFilter('budgetMin', e.target.value)}
                  type="number"
                />
                <Input
                  placeholder={t('max')}
                  value={filters.budgetMax}
                  onChange={(e) => updateFilter('budgetMax', e.target.value)}
                  type="number"
                />
                <Select value={filters.currency} onValueChange={(value) => updateFilter('currency', value)}>
                  <SelectTrigger className="w-20">
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
            </div>
          </div>
          
          {/* Priority and Deadline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">{t('priority')}</Label>
              <Select value={filters.priority} onValueChange={(value) => updateFilter('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPriority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {priorities.map((priority) => {
                    const Icon = priority.icon
                    return (
                      <SelectItem key={priority.id} value={priority.id}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", priority.color)} />
                          {priority.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('deadline')}
              </Label>
              <Select value={filters.deadline} onValueChange={(value) => updateFilter('deadline', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any deadline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any deadline</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="no-deadline">No deadline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Results Count */}
      {resultCount !== undefined && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {t('showingResults', { count: resultCount })}
          </span>
          
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              <Badge variant="secondary" className="text-xs">
                {[
                  filters.types.length > 0 && `${filters.types.length} types`,
                  filters.categories.length > 0 && `${filters.categories.length} categories`,
                  filters.location && 'location',
                  filters.priority && 'priority',
                  filters.budgetMin && 'budget'
                ].filter(Boolean).join(', ')}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdvancedFilters
