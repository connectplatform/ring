'use client'

import { useState, useTransition, useCallback } from 'react'
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
  Building2,
  Leaf,
  Palette,
  Factory,
  Users,
  Filter,
  X,
  ChevronDown,
  Search,
  CheckCircle,
  Award,
  Globe
} from 'lucide-react'
import { EntityType } from '@/features/entities/types'

interface EntityFilterState {
  search: string
  types: EntityType[]
  location: string
  employeeCountMin: string
  employeeCountMax: string
  foundedYearMin: string
  foundedYearMax: string
  verificationStatus: string
  membershipTier: string
  services: string[]
  certifications: boolean | null
  partnerships: boolean | null
}

interface EntitiesFiltersPanelProps {
  initialFilters?: Partial<EntityFilterState>
  resultCount?: number
  onFiltersApplied?: (filters: EntityFilterState) => void
}

// Agricultural entity types for GreenFood platform
const entityTypes = [
  { id: 'farm' as EntityType, icon: Leaf, color: 'bg-emerald-500', label: 'Farm' },
  { id: 'food_producer' as EntityType, icon: Factory, color: 'bg-blue-500', label: 'Food Producer' },
  { id: 'farmers_market' as EntityType, icon: Building2, color: 'bg-orange-500', label: 'Farmers Market' },
  { id: 'artisan_producer' as EntityType, icon: Palette, color: 'bg-purple-500', label: 'Artisan Producer' },
  { id: 'cooperative' as EntityType, icon: Users, color: 'bg-green-500', label: 'Cooperative' },
]

export default function EntitiesFiltersPanel({
  initialFilters,
  resultCount,
  onFiltersApplied
}: EntitiesFiltersPanelProps) {
  const t = useTranslations('modules.entities')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['types']))

  // React 19 useTransition for non-blocking filter updates
  const [isPending, startTransition] = useTransition()

  const [filters, setFilters] = useState<EntityFilterState>({
    search: '',
    types: [],
    location: '',
    employeeCountMin: '',
    employeeCountMax: '',
    foundedYearMin: '',
    foundedYearMax: '',
    verificationStatus: '',
    membershipTier: '',
    services: [],
    certifications: null,
    partnerships: null,
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

  const updateFilters = useCallback((updates: Partial<EntityFilterState>) => {
    startTransition(() => {
      setFilters(prev => ({ ...prev, ...updates }))
    })
  }, [startTransition])

  const handleClearFilters = () => {
    const clearedFilters: EntityFilterState = {
      search: '',
      types: [],
      location: '',
      employeeCountMin: '',
      employeeCountMax: '',
      foundedYearMin: '',
      foundedYearMax: '',
      verificationStatus: '',
      membershipTier: '',
      services: [],
      certifications: null,
      partnerships: null
    }
    setFilters(clearedFilters)
    onFiltersApplied?.(clearedFilters)
  }

  const handleApplyFilters = () => {
    onFiltersApplied?.(filters)
  }

  const toggleEntityType = (typeId: EntityType) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId]
    updateFilters({ types: newTypes })
  }

  const hasActiveFilters = () => {
    return filters.search ||
           filters.types.length > 0 ||
           filters.location ||
           filters.employeeCountMin ||
           filters.employeeCountMax ||
           filters.foundedYearMin ||
           filters.foundedYearMax ||
           filters.verificationStatus ||
           filters.membershipTier ||
           filters.services.length > 0 ||
           filters.certifications !== null ||
           filters.partnerships !== null
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-sm font-medium">
          {t('filters.search.label', { defaultValue: 'Search Entities' })}
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder={t('filters.search.placeholder', { defaultValue: 'Search by name, description...' })}
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
            <Label className="text-sm font-medium">
              {t('filters.active.title', { defaultValue: 'Active Filters' })}
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              {t('filters.active.clearAll', { defaultValue: 'Clear all' })}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.types.map(type => {
              const typeInfo = entityTypes.find(t => t.id === type)
              return (
                <Badge key={type} variant="secondary" className="text-xs">
                  {typeInfo?.label || type}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                    onClick={() => toggleEntityType(type)}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              )
            })}
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
            {(filters.employeeCountMin || filters.employeeCountMax) && (
              <Badge variant="secondary" className="text-xs">
                👥 {filters.employeeCountMin || '0'} - {filters.employeeCountMax || '∞'} employees
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                  onClick={() => updateFilters({ employeeCountMin: '', employeeCountMax: '' })}
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
        {/* Entity Types */}
        <Collapsible
          open={openSections.has('types')}
          onOpenChange={() => toggleSection('types')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">
                {t('filters.sections.types', { defaultValue: 'Entity Types' })}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('types') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {entityTypes.map((type) => {
                const IconComponent = type.icon
                const isSelected = filters.types.includes(type.id)
                return (
                  <Button
                    key={type.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start h-auto p-2"
                    onClick={() => toggleEntityType(type.id)}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full mr-2",
                      type.color,
                      isSelected && "ring-2 ring-white ring-offset-1"
                    )} />
                    <IconComponent className="w-4 h-4 mr-2" />
                    <span className="text-xs">{type.label}</span>
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
              <span className="text-sm font-medium">
                {t('filters.sections.location', { defaultValue: 'Location' })}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('location') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Input
              placeholder={t('filters.location.placeholder', { defaultValue: 'Enter city or country' })}
              value={filters.location}
              onChange={(e) => updateFilters({ location: e.target.value })}
            />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Employee Count */}
        <Collapsible
          open={openSections.has('employees')}
          onOpenChange={() => toggleSection('employees')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">
                {t('filters.sections.companySize', { defaultValue: 'Company Size' })}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('employees') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('filters.companySize.min', { defaultValue: 'Min' })}
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.employeeCountMin}
                  onChange={(e) => updateFilters({ employeeCountMin: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('filters.companySize.max', { defaultValue: 'Max' })}
                </Label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={filters.employeeCountMax}
                  onChange={(e) => updateFilters({ employeeCountMax: e.target.value })}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Founded Year */}
        <Collapsible
          open={openSections.has('founded')}
          onOpenChange={() => toggleSection('founded')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">
                {t('filters.sections.foundedYear', { defaultValue: 'Founded Year' })}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('founded') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('filters.foundedYear.from', { defaultValue: 'From' })}
                </Label>
                <Input
                  type="number"
                  placeholder="1900"
                  value={filters.foundedYearMin}
                  onChange={(e) => updateFilters({ foundedYearMin: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t('filters.foundedYear.to', { defaultValue: 'To' })}
                </Label>
                <Input
                  type="number"
                  placeholder={new Date().getFullYear().toString()}
                  value={filters.foundedYearMax}
                  onChange={(e) => updateFilters({ foundedYearMax: e.target.value })}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Verification Status */}
        <Collapsible
          open={openSections.has('verification')}
          onOpenChange={() => toggleSection('verification')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <span className="text-sm font-medium">
                {t('filters.sections.verification', { defaultValue: 'Verification' })}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                openSections.has('verification') && "transform rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-3">
            <Select
              value={filters.verificationStatus}
              onValueChange={(value) => updateFilters({ verificationStatus: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('filters.verification.anyStatus', { defaultValue: 'Any status' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  {t('filters.verification.anyStatus', { defaultValue: 'Any status' })}
                </SelectItem>
                <SelectItem value="verified">
                  {t('filters.verification.verified', { defaultValue: 'Verified' })}
                </SelectItem>
                <SelectItem value="pending">
                  {t('filters.verification.pending', { defaultValue: 'Pending' })}
                </SelectItem>
                <SelectItem value="unverified">
                  {t('filters.verification.unverified', { defaultValue: 'Unverified' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Apply Filters Button */}
      <Button className="w-full" onClick={handleApplyFilters}>
        <Filter className="w-4 h-4 mr-2" />
        {t('filters.apply', { defaultValue: 'Apply Filters' })}
        {resultCount !== undefined && (
          <Badge variant="secondary" className="ml-2">
            {resultCount}
          </Badge>
        )}
      </Button>
    </div>
  )
}
