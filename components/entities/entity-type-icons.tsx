"use client"

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
  LucideIcon
} from 'lucide-react'
import { EntityType } from '@/features/entities/types'
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

// Comprehensive entity type configuration with distinct visual identity
export const entityTypeConfigs: EntityTypeConfig[] = [
  {
    id: '3dPrinting',
    icon: Layers,
    color: 'purple',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-600',
    label: '3D Printing',
    description: 'Additive manufacturing and 3D printing services'
  },
  {
    id: 'aiMachineLearning',
    icon: Bot,
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    label: 'AI & Machine Learning',
    description: 'Artificial intelligence and machine learning solutions'
  },
  {
    id: 'biotechnology',
    icon: Dna,
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600',
    label: 'Biotechnology',
    description: 'Biological technology and life sciences'
  },
  {
    id: 'blockchainDevelopment',
    icon: Blocks,
    color: 'orange',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-600',
    label: 'Blockchain Development',
    description: 'Blockchain and distributed ledger technologies'
  },
  {
    id: 'cleanEnergy',
    icon: Leaf,
    color: 'emerald',
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    label: 'Clean Energy',
    description: 'Renewable energy and sustainable technologies'
  },
  {
    id: 'cloudComputing',
    icon: Cloud,
    color: 'sky',
    bgColor: 'bg-sky-500',
    textColor: 'text-sky-600',
    label: 'Cloud Computing',
    description: 'Cloud infrastructure and computing services'
  },
  {
    id: 'cncMachining',
    icon: Cog,
    color: 'gray',
    bgColor: 'bg-gray-500',
    textColor: 'text-gray-600',
    label: 'CNC Machining',
    description: 'Computer numerical control machining services'
  },
  {
    id: 'compositeManufacturing',
    icon: Layers,
    color: 'indigo',
    bgColor: 'bg-indigo-500',
    textColor: 'text-indigo-600',
    label: 'Composite Manufacturing',
    description: 'Advanced composite materials and manufacturing'
  },
  {
    id: 'cybersecurity',
    icon: Shield,
    color: 'red',
    bgColor: 'bg-red-500',
    textColor: 'text-red-600',
    label: 'Cybersecurity',
    description: 'Information security and cyber protection services'
  },
  {
    id: 'droneTechnology',
    icon: Plane,
    color: 'teal',
    bgColor: 'bg-teal-500',
    textColor: 'text-teal-600',
    label: 'Drone Technology',
    description: 'Unmanned aerial vehicles and drone services'
  },
  {
    id: 'electronicManufacturing',
    icon: Zap,
    color: 'yellow',
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    label: 'Electronic Manufacturing',
    description: 'Electronic components and device manufacturing'
  },
  {
    id: 'industrialDesign',
    icon: Palette,
    color: 'pink',
    bgColor: 'bg-pink-500',
    textColor: 'text-pink-600',
    label: 'Industrial Design',
    description: 'Product design and industrial design services'
  },
  {
    id: 'iotDevelopment',
    icon: Wifi,
    color: 'cyan',
    bgColor: 'bg-cyan-500',
    textColor: 'text-cyan-600',
    label: 'IoT Development',
    description: 'Internet of Things and connected device solutions'
  },
  {
    id: 'laserCutting',
    icon: Scissors,
    color: 'rose',
    bgColor: 'bg-rose-500',
    textColor: 'text-rose-600',
    label: 'Laser Cutting',
    description: 'Precision laser cutting and engraving services'
  },
  {
    id: 'manufacturing',
    icon: Factory,
    color: 'amber',
    bgColor: 'bg-amber-500',
    textColor: 'text-amber-600',
    label: 'Manufacturing',
    description: 'General manufacturing and production services'
  },
  {
    id: 'metalFabrication',
    icon: Wrench,
    color: 'slate',
    bgColor: 'bg-slate-500',
    textColor: 'text-slate-600',
    label: 'Metal Fabrication',
    description: 'Metal working and fabrication services'
  },
  {
    id: 'other',
    icon: Package,
    color: 'neutral',
    bgColor: 'bg-neutral-500',
    textColor: 'text-neutral-600',
    label: 'Other',
    description: 'Other specialized services and technologies'
  },
  {
    id: 'plasticInjectionMolding',
    icon: Package,
    color: 'lime',
    bgColor: 'bg-lime-500',
    textColor: 'text-lime-600',
    label: 'Plastic Injection Molding',
    description: 'Plastic injection molding and polymer processing'
  },
  {
    id: 'precisionEngineering',
    icon: Gauge,
    color: 'violet',
    bgColor: 'bg-violet-500',
    textColor: 'text-violet-600',
    label: 'Precision Engineering',
    description: 'High-precision engineering and manufacturing'
  },
  {
    id: 'quantumComputing',
    icon: Atom,
    color: 'fuchsia',
    bgColor: 'bg-fuchsia-500',
    textColor: 'text-fuchsia-600',
    label: 'Quantum Computing',
    description: 'Quantum computing and quantum technologies'
  },
  {
    id: 'robotics',
    icon: Bot,
    color: 'blue',
    bgColor: 'bg-blue-600',
    textColor: 'text-blue-700',
    label: 'Robotics',
    description: 'Robotics and automation solutions'
  },
  {
    id: 'semiconductorProduction',
    icon: Microchip,
    color: 'green',
    bgColor: 'bg-green-600',
    textColor: 'text-green-700',
    label: 'Semiconductor Production',
    description: 'Semiconductor manufacturing and chip production'
  },
  {
    id: 'smartMaterials',
    icon: Sparkles,
    color: 'purple',
    bgColor: 'bg-purple-600',
    textColor: 'text-purple-700',
    label: 'Smart Materials',
    description: 'Advanced and smart materials development'
  },
  {
    id: 'softwareDevelopment',
    icon: Code,
    color: 'blue',
    bgColor: 'bg-blue-700',
    textColor: 'text-blue-800',
    label: 'Software Development',
    description: 'Software development and programming services'
  },
  {
    id: 'technologyCenter',
    icon: Building2,
    color: 'indigo',
    bgColor: 'bg-indigo-600',
    textColor: 'text-indigo-700',
    label: 'Technology Center',
    description: 'Technology incubators and innovation centers'
  },
  {
    id: 'virtualReality',
    icon: Cpu,
    color: 'pink',
    bgColor: 'bg-pink-600',
    textColor: 'text-pink-700',
    label: 'Virtual Reality',
    description: 'Virtual and augmented reality technologies'
  }
]

// Helper function to get entity type configuration
export const getEntityTypeConfig = (type: EntityType): EntityTypeConfig => {
  return entityTypeConfigs.find(config => config.id === type) || entityTypeConfigs.find(config => config.id === 'other')!
}

// Entity Type Icon Component
interface EntityTypeIconProps {
  type: EntityType
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
  className
}) => {
  const config = getEntityTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-8 h-8'
  }

  const containerClasses = cn(
    'inline-flex items-center justify-center rounded-full',
    sizeClasses[size],
    variant === 'filled' && config.bgColor,
    variant === 'outline' && `border-2 border-${config.color}-500 ${config.textColor}`,
    variant === 'minimal' && config.textColor,
    className
  )

  const iconClasses = cn(
    iconSizeClasses[size],
    variant === 'filled' ? 'text-white' : config.textColor
  )

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

// Entity Type Badge Component
interface EntityTypeBadgeProps {
  type: EntityType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const EntityTypeBadge: React.FC<EntityTypeBadgeProps> = ({
  type,
  size = 'md',
  className
}) => {
  const config = getEntityTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full font-medium',
      config.bgColor,
      'text-white',
      sizeClasses[size],
      className
    )}>
      <Icon className={iconSizeClasses[size]} />
      <span>{config.label}</span>
    </div>
  )
}

// Entity Type Grid Component for selection
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
  columns = 3
}) => {
  return (
    <div className={cn(
      'grid gap-2 overflow-y-auto',
      `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`,
      maxHeight
    )}>
      {entityTypeConfigs.map((config) => {
        const Icon = config.icon
        const isSelected = selectedTypes.includes(config.id)
        
        return (
          <button
            key={config.id}
            onClick={() => onTypeToggle(config.id)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              isSelected 
                ? `${config.bgColor} text-white border-transparent shadow-md` 
                : 'border-border hover:border-border/80 hover:bg-muted/50'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isSelected ? 'bg-white/20' : config.bgColor
            )}>
              <Icon className={cn(
                'w-4 h-4',
                isSelected ? 'text-white' : 'text-white'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {config.label}
              </div>
              <div className={cn(
                'text-xs truncate',
                isSelected ? 'text-white/80' : 'text-muted-foreground'
              )}>
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
