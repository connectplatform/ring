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
  Building2,
  Cpu,
  Dna,
  Blocks,
  Leaf,
  Cloud,
  Cog,
  Layers,
  Shield,
  Plane,
  Zap,
  Palette,
  Wifi,
  Scissors,
  Factory,
  Wrench,
  Package,
  Gauge,
  Atom,
  Bot,
  Microchip,
  Sparkles,
  Code,
  MapPin,
  Users,
  Calendar as CalendarIcon,
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

interface EntityAdvancedFiltersProps {
  filters: EntityFilterState
  onFiltersChange: (filters: EntityFilterState) => void
  onClearFilters: () => void
  resultCount?: number
}

// Entity types with icons and colors for visual distinction
const entityTypes = [
  { id: '3dPrinting' as EntityType, icon: Layers, color: 'bg-purple-500', label: '3D Printing' },
  { id: 'aiMachineLearning' as EntityType, icon: Bot, color: 'bg-blue-500', label: 'AI & Machine Learning' },
  { id: 'biotechnology' as EntityType, icon: Dna, color: 'bg-green-500', label: 'Biotechnology' },
  { id: 'blockchainDevelopment' as EntityType, icon: Blocks, color: 'bg-orange-500', label: 'Blockchain Development' },
  { id: 'cleanEnergy' as EntityType, icon: Leaf, color: 'bg-emerald-500', label: 'Clean Energy' },
  { id: 'cloudComputing' as EntityType, icon: Cloud, color: 'bg-sky-500', label: 'Cloud Computing' },
  { id: 'cncMachining' as EntityType, icon: Cog, color: 'bg-gray-500', label: 'CNC Machining' },
  { id: 'compositeManufacturing' as EntityType, icon: Layers, color: 'bg-indigo-500', label: 'Composite Manufacturing' },
  { id: 'cybersecurity' as EntityType, icon: Shield, color: 'bg-red-500', label: 'Cybersecurity' },
  { id: 'droneTechnology' as EntityType, icon: Plane, color: 'bg-teal-500', label: 'Drone Technology' },
  { id: 'electronicManufacturing' as EntityType, icon: Zap, color: 'bg-yellow-500', label: 'Electronic Manufacturing' },
  { id: 'industrialDesign' as EntityType, icon: Palette, color: 'bg-pink-500', label: 'Industrial Design' },
  { id: 'iotDevelopment' as EntityType, icon: Wifi, color: 'bg-cyan-500', label: 'IoT Development' },
  { id: 'laserCutting' as EntityType, icon: Scissors, color: 'bg-rose-500', label: 'Laser Cutting' },
  { id: 'manufacturing' as EntityType, icon: Factory, color: 'bg-amber-500', label: 'Manufacturing' },
  { id: 'metalFabrication' as EntityType, icon: Wrench, color: 'bg-slate-500', label: 'Metal Fabrication' },
  { id: 'other' as EntityType, icon: Package, color: 'bg-neutral-500', label: 'Other' },
  { id: 'plasticInjectionMolding' as EntityType, icon: Package, color: 'bg-lime-500', label: 'Plastic Injection Molding' },
  { id: 'precisionEngineering' as EntityType, icon: Gauge, color: 'bg-violet-500', label: 'Precision Engineering' },
  { id: 'quantumComputing' as EntityType, icon: Atom, color: 'bg-fuchsia-500', label: 'Quantum Computing' },
  { id: 'robotics' as EntityType, icon: Bot, color: 'bg-blue-600', label: 'Robotics' },
  { id: 'semiconductorProduction' as EntityType, icon: Microchip, color: 'bg-green-600', label: 'Semiconductor Production' },
  { id: 'smartMaterials' as EntityType, icon: Sparkles, color: 'bg-purple-600', label: 'Smart Materials' },
  { id: 'softwareDevelopment' as EntityType, icon: Code, color: 'bg-blue-700', label: 'Software Development' },
  { id: 'technologyCenter' as EntityType, icon: Building2, color: 'bg-indigo-600', label: 'Technology Center' },
  { id: 'virtualReality' as EntityType, icon: Cpu, color: 'bg-pink-600', label: 'Virtual Reality' }
]

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
  
  // Get translated type name
  const getTypeTranslation = (type: EntityType) => {
    const typeMap: { [key in EntityType]: string } = {
      '3dPrinting': t('types.3dPrinting'),
      'aiMachineLearning': t('types.aiMachineLearning'),
      'biotechnology': t('types.biotechnology'),
      'blockchainDevelopment': t('types.blockchainDevelopment'),
      'cleanEnergy': t('types.cleanEnergy'),
      'cloudComputing': t('types.cloudComputing'),
      'cncMachining': t('types.cncMachining'),
      'compositeManufacturing': t('types.compositeManufacturing'),
      'cybersecurity': t('types.cybersecurity'),
      'droneTechnology': t('types.droneTechnology'),
      'electronicManufacturing': t('types.electronicManufacturing'),
      'industrialDesign': t('types.industrialDesign'),
      'iotDevelopment': t('types.iotDevelopment'),
      'laserCutting': t('types.laserCutting'),
      'manufacturing': t('types.manufacturing'),
      'metalFabrication': t('types.metalFabrication'),
      'other': t('types.other'),
      'plasticInjectionMolding': t('types.plasticInjectionMolding'),
      'precisionEngineering': t('types.precisionEngineering'),
      'quantumComputing': t('types.quantumComputing'),
      'robotics': t('types.robotics'),
      'semiconductorProduction': t('types.semiconductorProduction'),
      'smartMaterials': t('types.smartMaterials'),
      'softwareDevelopment': t('types.softwareDevelopment'),
      'technologyCenter': t('types.technologyCenter'),
      'virtualReality': t('types.virtualReality')
    }
    return typeMap[type] || type
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
          {entityTypes.map((type) => {
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
                  filters.types.length > 0 && `${filters.types.length} ${t('types')}`,
                  filters.location && t('location'),
                  filters.verificationStatus !== 'all' && t('verification'),
                  filters.employeeCountMin && t('companySize')
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
