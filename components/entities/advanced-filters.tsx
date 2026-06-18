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
  MapPin,
  Users,
  Calendar as CalendarIcon,
  Filter,
  X,
  ChevronDown,
  Search,
  CheckCircle,
  Award,
  Globe,
} from 'lucide-react'
import { EntityType } from '@/features/entities/types'
import { entityTypeConfigs } from '@/components/entities/entity-type-icons'
import { resolveEntityType } from '@/lib/entities/legacy-entity-type-map'

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

interface EntityAdvancedFiltersProps {
  filters: EntityFilterState
  onFiltersChange: (filters: EntityFilterState) => void
  onClearFilters: () => void
  resultCount?: number
}

const employeeCountRanges = [
  { id: '1-10', label: '1-10 employees' },
  { id: '11-50', label: '11-50 employees' },
  { id: '51-200', label: '51-200 employees' },
  { id: '201-500', label: '201-500 employees' },
  { id: '501-1000', label: '501-1000 employees' },
  { id: '1000+', label: '1000+ employees' }
]

const verificationStatuses = [
  { id: 'all', label: 'All Entities' },
  { id: 'verified', label: 'Verified Only', icon: CheckCircle },
  { id: 'unverified', label: 'Unverified Only' },
  { id: 'premium', label: 'Premium Verified', icon: Award }
]

const membershipTiers = [
  { id: 'all', label: 'All Tiers' },
  { id: 'subscriber', label: 'Subscriber' },
  { id: 'member', label: 'Member' },
  { id: 'confidential', label: 'Confidential' }
]

const EntityAdvancedFilters = ({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  resultCount 
}: EntityAdvancedFiltersProps) => {
  const t = useTranslations('modules.entities')
  const tCommon = useTranslations('common')
  const [isExpanded, setIsExpanded] = useState(false)
  
  const getTypeTranslation = (type: EntityType | string) => {
    const resolved = resolveEntityType(type)
    return t(`types.${resolved}`)
  }
  
  const updateFilter = (key: keyof EntityFilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }
  
  const toggleType = (typeId: EntityType) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId]
    updateFilter('types', newTypes)
  }
  
  const hasActiveFilters = 
    filters.search ||
    filters.types.length > 0 ||
    filters.location ||
    filters.employeeCountMin ||
    filters.employeeCountMax ||
    filters.foundedYearMin ||
    filters.foundedYearMax ||
    filters.verificationStatus !== 'all' ||
    filters.membershipTier !== 'all' ||
    filters.services.length > 0 ||
    filters.certifications !== null ||
    filters.partnerships !== null

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      {/* Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchEntities')}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="gap-2">
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
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="h-4 w-4 mr-1" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {/* Entity Types - Always Visible */}
      <div>
        <Label className="text-sm font-medium mb-3 block">{t('industryType')}</Label>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {entityTypeConfigs.map((type) => {
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
                <div className={cn("w-3 h-3 rounded-full flex items-center justify-center", type.bgColor)}>
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
          
          {/* Location and Company Size */}
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
                <Users className="h-4 w-4" />
                {t('employeeCount')}
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('min')}
                  value={filters.employeeCountMin}
                  onChange={(e) => updateFilter('employeeCountMin', e.target.value)}
                  type="number"
                />
                <Input
                  placeholder={t('max')}
                  value={filters.employeeCountMax}
                  onChange={(e) => updateFilter('employeeCountMax', e.target.value)}
                  type="number"
                />
              </div>
            </div>
          </div>
          
          {/* Founded Year and Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {t('foundedYear')}
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('from')}
                  value={filters.foundedYearMin}
                  onChange={(e) => updateFilter('foundedYearMin', e.target.value)}
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                />
                <Input
                  placeholder={t('to')}
                  value={filters.foundedYearMax}
                  onChange={(e) => updateFilter('foundedYearMax', e.target.value)}
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t('verificationStatus')}
              </Label>
              <Select value={filters.verificationStatus} onValueChange={(value) => updateFilter('verificationStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectVerification')} />
                </SelectTrigger>
                <SelectContent>
                  {verificationStatuses.map((status) => {
                    const Icon = status.icon
                    return (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          {status.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Membership Tier */}
          <div>
            <Label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Award className="h-4 w-4" />
              {t('membershipTier')}
            </Label>
            <Select value={filters.membershipTier} onValueChange={(value) => updateFilter('membershipTier', value)}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder={t('selectTier')} />
              </SelectTrigger>
              <SelectContent>
                {membershipTiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Additional Filters */}
          <div className="flex flex-wrap gap-4">
            <Button
              variant={filters.certifications === true ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter('certifications', filters.certifications === true ? null : true)}
              className="gap-2"
            >
              <Award className="h-4 w-4" />
              {t('hasCertifications')}
            </Button>
            
            <Button
              variant={filters.partnerships === true ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter('partnerships', filters.partnerships === true ? null : true)}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              {t('hasPartnerships')}
            </Button>
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
              <span className="text-xs text-muted-foreground">{tCommon('activeFilters')}:</span>
              <Badge variant="secondary" className="text-xs">
                {[
                  filters.types.length > 0 && `${filters.types.length} ${t('filters.types')}`,
                  filters.location && t('filters.location'),
                  filters.verificationStatus !== 'all' && t('filters.verification'),
                  filters.employeeCountMin && t('filters.companySize')
                ].filter(Boolean).join(', ')}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EntityAdvancedFilters
