'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Building2,
  Factory,
  Leaf,
  Palette,
  Users
} from 'lucide-react'
import type { EntityType } from '@/features/entities/types'

interface EntityTypeConfig {
  id: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  textColor: string
  label: string
  description: string
}

// Agricultural entity type configuration for GreenFood platform
export const entityTypeConfigs: EntityTypeConfig[] = [
  {
    id: 'farm',
    icon: Leaf,
    color: 'emerald',
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    label: 'Farm',
    description: 'Agricultural farms producing crops, livestock, and sustainable food'
  },
  {
    id: 'food_producer',
    icon: Factory,
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    label: 'Food Producer',
    description: 'Food processing and manufacturing companies'
  },
  {
    id: 'farmers_market',
    icon: Building2,
    color: 'orange',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-600',
    label: 'Farmers Market',
    description: 'Local farmers markets and cooperative marketplaces'
  },
  {
    id: 'artisan_producer',
    icon: Palette,
    color: 'purple',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-600',
    label: 'Artisan Producer',
    description: 'Artisanal food producers specializing in traditional and craft foods'
  },
  {
    id: 'cooperative',
    icon: Users,
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600',
    label: 'Cooperative',
    description: 'Agricultural cooperatives and producer associations'
  },
]

export const getEntityTypeConfig = (type: EntityType): EntityTypeConfig => {
  const config = entityTypeConfigs.find(config => config.id === type)
  if (!config) {
    // Fallback for unknown types
    return {
      id: type,
      icon: Building2,
      color: 'gray',
      bgColor: 'bg-gray-500',
      textColor: 'text-gray-600',
      label: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
      description: `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} entity`
    }
  }
  return config
}

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

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
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

  return (
    <div className={containerClasses}>
      <config.icon className={iconClasses} />
      {showLabel && (
        <span className={cn('ml-2 text-sm font-medium', config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

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

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        'text-white',
        sizeClasses[size],
        className
      )}
    >
      <config.icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

interface EntityTypeGridProps {
  types?: EntityType[]
  selectedTypes?: EntityType[]
  onTypeToggle?: (type: EntityType) => void
  maxItems?: number
  className?: string
}

export const EntityTypeGrid: React.FC<EntityTypeGridProps> = ({
  types = entityTypeConfigs.map(config => config.id as EntityType),
  selectedTypes = [],
  onTypeToggle,
  maxItems,
  className
}) => {
  const displayTypes = maxItems ? types.slice(0, maxItems) : types

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {displayTypes.map((type) => {
        const config = getEntityTypeConfig(type)
        const isSelected = selectedTypes.includes(type)

        return (
          <button
            key={type}
            onClick={() => onTypeToggle?.(type)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all',
              'hover:shadow-md',
              isSelected
                ? `${config.bgColor} text-white border-transparent`
                : 'bg-background border-border hover:border-primary/50'
            )}
          >
            <config.icon className="w-5 h-5 flex-shrink-0" />
            <div className="text-left min-w-0">
              <div className={cn(
                'font-medium truncate',
                isSelected ? 'text-white' : config.textColor
              )}>
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