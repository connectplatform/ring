"use client"

import {
  Code,
  Factory,
  Landmark,
  HeartPulse,
  GraduationCap,
  Building2,
  ShoppingCart,
  Briefcase,
  Clapperboard,
  Truck,
  Zap,
  Wheat,
  Building,
  Heart,
  FlaskConical,
  Users,
  Scale,
  Megaphone,
  Plane,
  Trophy,
  Palette,
  TreePine,
  Radio,
  Rocket,
  Pill,
  Package,
  LucideIcon,
} from 'lucide-react'
import { EntityType } from '@/features/entities/types'
import { resolveEntityType } from '@/lib/entities/legacy-entity-type-map'
import { cn } from '@/lib/utils'

export interface EntityTypeConfig {
  id: EntityType
  icon: LucideIcon
  color: string
  bgColor: string
  textColor: string
  label: string
  description: string
}

/** 26 professional industry categories — ring-platform.org community portal SSOT */
export const entityTypeConfigs: EntityTypeConfig[] = [
  {
    id: 'technologySoftware',
    icon: Code,
    color: 'blue',
    bgColor: 'bg-blue-600',
    textColor: 'text-blue-700',
    label: 'Technology & Software',
    description: 'Software, SaaS, AI, cloud, cybersecurity, and digital product companies',
  },
  {
    id: 'manufacturingIndustry',
    icon: Factory,
    color: 'amber',
    bgColor: 'bg-amber-600',
    textColor: 'text-amber-700',
    label: 'Manufacturing & Industry',
    description: 'Production, industrial automation, and supply-chain organizations',
  },
  {
    id: 'financialServices',
    icon: Landmark,
    color: 'emerald',
    bgColor: 'bg-emerald-600',
    textColor: 'text-emerald-700',
    label: 'Financial Services',
    description: 'Banking, fintech, insurance, investment, and financial advisory',
  },
  {
    id: 'healthcareMedical',
    icon: HeartPulse,
    color: 'rose',
    bgColor: 'bg-rose-600',
    textColor: 'text-rose-700',
    label: 'Healthcare & Medical',
    description: 'Hospitals, clinics, medtech, and health services providers',
  },
  {
    id: 'educationTraining',
    icon: GraduationCap,
    color: 'indigo',
    bgColor: 'bg-indigo-600',
    textColor: 'text-indigo-700',
    label: 'Education & Training',
    description: 'Universities, schools, edtech, and professional training providers',
  },
  {
    id: 'realEstateConstruction',
    icon: Building2,
    color: 'slate',
    bgColor: 'bg-slate-600',
    textColor: 'text-slate-700',
    label: 'Real Estate & Construction',
    description: 'Developers, contractors, architecture, and property management',
  },
  {
    id: 'retailEcommerce',
    icon: ShoppingCart,
    color: 'orange',
    bgColor: 'bg-orange-600',
    textColor: 'text-orange-700',
    label: 'Retail & E-commerce',
    description: 'Retail brands, marketplaces, and omnichannel commerce',
  },
  {
    id: 'professionalServices',
    icon: Briefcase,
    color: 'cyan',
    bgColor: 'bg-cyan-600',
    textColor: 'text-cyan-700',
    label: 'Professional Services',
    description: 'Accounting, HR, design, engineering, and B2B service firms',
  },
  {
    id: 'mediaEntertainment',
    icon: Clapperboard,
    color: 'fuchsia',
    bgColor: 'bg-fuchsia-600',
    textColor: 'text-fuchsia-700',
    label: 'Media & Entertainment',
    description: 'Studios, publishers, streaming, gaming, and creative media',
  },
  {
    id: 'transportationLogistics',
    icon: Truck,
    color: 'yellow',
    bgColor: 'bg-yellow-600',
    textColor: 'text-yellow-700',
    label: 'Transportation & Logistics',
    description: 'Freight, mobility, warehousing, and last-mile delivery',
  },
  {
    id: 'energyUtilities',
    icon: Zap,
    color: 'lime',
    bgColor: 'bg-lime-600',
    textColor: 'text-lime-700',
    label: 'Energy & Utilities',
    description: 'Power, renewables, utilities, and energy infrastructure',
  },
  {
    id: 'agricultureFood',
    icon: Wheat,
    color: 'green',
    bgColor: 'bg-green-600',
    textColor: 'text-green-700',
    label: 'Agriculture & Food',
    description: 'Farms, food producers, agtech, and agrifood supply chains',
  },
  {
    id: 'governmentPublicSector',
    icon: Building,
    color: 'stone',
    bgColor: 'bg-stone-600',
    textColor: 'text-stone-700',
    label: 'Government & Public Sector',
    description: 'Public agencies, municipalities, and government programs',
  },
  {
    id: 'nonProfitNgo',
    icon: Heart,
    color: 'pink',
    bgColor: 'bg-pink-600',
    textColor: 'text-pink-700',
    label: 'Non-Profit & NGO',
    description: 'Charities, foundations, and civil-society organizations',
  },
  {
    id: 'researchDevelopment',
    icon: FlaskConical,
    color: 'violet',
    bgColor: 'bg-violet-600',
    textColor: 'text-violet-700',
    label: 'Research & Development',
    description: 'Labs, innovation centers, and R&D institutes',
  },
  {
    id: 'consultingAdvisory',
    icon: Users,
    color: 'sky',
    bgColor: 'bg-sky-600',
    textColor: 'text-sky-700',
    label: 'Consulting & Advisory',
    description: 'Management consulting and strategic advisory practices',
  },
  {
    id: 'legalServices',
    icon: Scale,
    color: 'neutral',
    bgColor: 'bg-neutral-600',
    textColor: 'text-neutral-700',
    label: 'Legal Services',
    description: 'Law firms, compliance, and legal technology providers',
  },
  {
    id: 'marketingAdvertising',
    icon: Megaphone,
    color: 'purple',
    bgColor: 'bg-purple-600',
    textColor: 'text-purple-700',
    label: 'Marketing & Advertising',
    description: 'Agencies, mar-tech, and brand growth specialists',
  },
  {
    id: 'hospitalityTourism',
    icon: Plane,
    color: 'teal',
    bgColor: 'bg-teal-600',
    textColor: 'text-teal-700',
    label: 'Hospitality & Tourism',
    description: 'Hotels, travel, venues, and experience operators',
  },
  {
    id: 'sportsRecreation',
    icon: Trophy,
    color: 'amber',
    bgColor: 'bg-amber-500',
    textColor: 'text-amber-600',
    label: 'Sports & Recreation',
    description: 'Clubs, leagues, fitness, and recreation businesses',
  },
  {
    id: 'artsCulture',
    icon: Palette,
    color: 'rose',
    bgColor: 'bg-rose-500',
    textColor: 'text-rose-600',
    label: 'Arts & Culture',
    description: 'Museums, galleries, cultural institutions, and artists',
  },
  {
    id: 'environmentalServices',
    icon: TreePine,
    color: 'emerald',
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    label: 'Environmental Services',
    description: 'Sustainability, remediation, and environmental consulting',
  },
  {
    id: 'telecommunications',
    icon: Radio,
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    label: 'Telecommunications',
    description: 'Telcos, ISPs, and connectivity infrastructure providers',
  },
  {
    id: 'aerospaceDefense',
    icon: Rocket,
    color: 'indigo',
    bgColor: 'bg-indigo-500',
    textColor: 'text-indigo-600',
    label: 'Aerospace & Defense',
    description: 'Aviation, space, defense contractors, and dual-use tech',
  },
  {
    id: 'pharmaceuticals',
    icon: Pill,
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600',
    label: 'Pharmaceuticals',
    description: 'Drug development, pharma manufacturing, and life-science vendors',
  },
  {
    id: 'other',
    icon: Package,
    color: 'gray',
    bgColor: 'bg-gray-500',
    textColor: 'text-gray-600',
    label: 'Other',
    description: 'Organizations that do not fit a single category above',
  },
]

export const getEntityTypeConfig = (type: EntityType | string): EntityTypeConfig => {
  const resolved = resolveEntityType(type)
  return (
    entityTypeConfigs.find((config) => config.id === resolved) ||
    entityTypeConfigs.find((config) => config.id === 'other')!
  )
}

interface EntityTypeIconProps {
  type: EntityType | string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'filled' | 'outline' | 'minimal'
  showLabel?: boolean
  className?: string
}

export const EntityTypeIcon: React.FC<EntityTypeIconProps> = ({
  type,
  size = 'md',
  variant = 'filled',
  showLabel = false,
  className,
}) => {
  const config = getEntityTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-8 h-8',
  }

  const containerClasses = cn(
    'inline-flex items-center justify-center rounded-full',
    sizeClasses[size],
    variant === 'filled' && config.bgColor,
    variant === 'outline' && `border-2 border-${config.color}-500 ${config.textColor}`,
    variant === 'minimal' && config.textColor,
    className
  )

  const iconClasses = cn(iconSizeClasses[size], variant === 'filled' ? 'text-white' : config.textColor)

  if (showLabel) {
    return (
      <div className="flex items-center gap-2">
        <div className={containerClasses}>
          <Icon className={iconClasses} />
        </div>
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    )
  }

  return (
    <div className={containerClasses} title={config.label}>
      <Icon className={iconClasses} />
    </div>
  )
}

interface EntityTypeBadgeProps {
  type: EntityType | string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const EntityTypeBadge: React.FC<EntityTypeBadgeProps> = ({
  type,
  size = 'md',
  className,
}) => {
  const config = getEntityTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-medium text-white',
        config.bgColor,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizeClasses[size]} />
      <span>{config.label}</span>
    </div>
  )
}

interface EntityTypeGridProps {
  selectedTypes: EntityType[]
  onTypeToggle: (type: EntityType) => void
  maxHeight?: string
  columns?: number
}

export const EntityTypeGrid: React.FC<EntityTypeGridProps> = ({
  selectedTypes,
  onTypeToggle,
  maxHeight = 'max-h-64',
  columns = 3,
}) => {
  return (
    <div
      className={cn(
        'grid gap-2 overflow-y-auto',
        `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`,
        maxHeight
      )}
    >
      {entityTypeConfigs.map((config) => {
        const Icon = config.icon
        const isSelected = selectedTypes.includes(config.id)

        return (
          <button
            key={config.id}
            type="button"
            onClick={() => onTypeToggle(config.id)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              isSelected
                ? `${config.bgColor} text-white border-transparent shadow-md`
                : 'border-border hover:border-border/80 hover:bg-muted/50'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                isSelected ? 'bg-white/20' : config.bgColor
              )}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{config.label}</div>
              <div
                className={cn(
                  'text-xs truncate',
                  isSelected ? 'text-white/80' : 'text-muted-foreground'
                )}
              >
                {config.description}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default EntityTypeIcon
