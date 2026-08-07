"use client"

import React, { useCallback } from 'react'
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
  Leaf,
  LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EntityType } from '@/features/entities/types'
import { getEntityTypes } from '@/features/entities/presets'
import { resolveEntityType } from '@/lib/entities/legacy-entity-type-map'
import { cn } from '@/lib/utils'

/**
 * SSOT layering (Preset SSOT doctrine — see docs/en/customization/vertical-presets.mdx):
 * - Type catalog (ids, fallback names/descriptions, emoji): features/entities/presets/<preset>.ts,
 *   selected by ring-config `entities.preset` via getEntityTypes().
 * - Copy (labels/descriptions): locales modules/entities.json `types.<id>` / `types.<id>Desc`
 *   — use useEntityTypeLabel()/useEntityTypeDescription(); catalog name is English fallback only.
 * - Visual skin (lucide icon + Tailwind colors): TYPE_VISUALS map below — design data, per-id.
 * Do NOT hardcode label/description strings here.
 */

export interface EntityTypeConfig {
  id: EntityType
  icon: LucideIcon
  color: string
  bgColor: string
  textColor: string
  /** English fallback from preset catalog — render via useEntityTypeLabel() for i18n */
  label: string
  /** English fallback from preset catalog — render via useEntityTypeDescription() for i18n */
  description: string
}

interface TypeVisual {
  icon: LucideIcon
  color: string
  bgColor: string
  textColor: string
}

/** Lucide + color skin per known type id (platform industries + shared fallbacks). */
const TYPE_VISUALS: Record<string, TypeVisual> = {
  technologySoftware: { icon: Code, color: 'blue', bgColor: 'bg-blue-600', textColor: 'text-blue-700' },
  manufacturingIndustry: { icon: Factory, color: 'amber', bgColor: 'bg-amber-600', textColor: 'text-amber-700' },
  financialServices: { icon: Landmark, color: 'emerald', bgColor: 'bg-emerald-600', textColor: 'text-emerald-700' },
  healthcareMedical: { icon: HeartPulse, color: 'rose', bgColor: 'bg-rose-600', textColor: 'text-rose-700' },
  educationTraining: { icon: GraduationCap, color: 'indigo', bgColor: 'bg-indigo-600', textColor: 'text-indigo-700' },
  realEstateConstruction: { icon: Building2, color: 'slate', bgColor: 'bg-slate-600', textColor: 'text-slate-700' },
  retailEcommerce: { icon: ShoppingCart, color: 'orange', bgColor: 'bg-orange-600', textColor: 'text-orange-700' },
  professionalServices: { icon: Briefcase, color: 'cyan', bgColor: 'bg-cyan-600', textColor: 'text-cyan-700' },
  mediaEntertainment: { icon: Clapperboard, color: 'fuchsia', bgColor: 'bg-fuchsia-600', textColor: 'text-fuchsia-700' },
  transportationLogistics: { icon: Truck, color: 'yellow', bgColor: 'bg-yellow-600', textColor: 'text-yellow-700' },
  energyUtilities: { icon: Zap, color: 'lime', bgColor: 'bg-lime-600', textColor: 'text-lime-700' },
  agricultureFood: { icon: Wheat, color: 'green', bgColor: 'bg-green-600', textColor: 'text-green-700' },
  governmentPublicSector: { icon: Building, color: 'stone', bgColor: 'bg-stone-600', textColor: 'text-stone-700' },
  nonProfitNgo: { icon: Heart, color: 'pink', bgColor: 'bg-pink-600', textColor: 'text-pink-700' },
  researchDevelopment: { icon: FlaskConical, color: 'violet', bgColor: 'bg-violet-600', textColor: 'text-violet-700' },
  consultingAdvisory: { icon: Users, color: 'sky', bgColor: 'bg-sky-600', textColor: 'text-sky-700' },
  legalServices: { icon: Scale, color: 'neutral', bgColor: 'bg-neutral-600', textColor: 'text-neutral-700' },
  marketingAdvertising: { icon: Megaphone, color: 'purple', bgColor: 'bg-purple-600', textColor: 'text-purple-700' },
  hospitalityTourism: { icon: Plane, color: 'teal', bgColor: 'bg-teal-600', textColor: 'text-teal-700' },
  sportsRecreation: { icon: Trophy, color: 'amber', bgColor: 'bg-amber-500', textColor: 'text-amber-600' },
  artsCulture: { icon: Palette, color: 'rose', bgColor: 'bg-rose-500', textColor: 'text-rose-600' },
  environmentalServices: { icon: TreePine, color: 'emerald', bgColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
  telecommunications: { icon: Radio, color: 'blue', bgColor: 'bg-blue-500', textColor: 'text-blue-600' },
  aerospaceDefense: { icon: Rocket, color: 'indigo', bgColor: 'bg-indigo-500', textColor: 'text-indigo-600' },
  pharmaceuticals: { icon: Pill, color: 'green', bgColor: 'bg-green-500', textColor: 'text-green-600' },
  other: { icon: Package, color: 'gray', bgColor: 'bg-gray-500', textColor: 'text-gray-600' },
}

/** Default skin for vertical-preset ids without a dedicated visual (e.g. agricultural catalog). */
const DEFAULT_VISUAL: TypeVisual = {
  icon: Leaf,
  color: 'emerald',
  bgColor: 'bg-emerald-600',
  textColor: 'text-emerald-700',
}

const getVisual = (id: string): TypeVisual => TYPE_VISUALS[id] ?? DEFAULT_VISUAL

/**
 * Active vertical's entity type configs — catalog (ids/names) × visual skin.
 * Derived from ring-config `entities.preset`; platform clones get the 26 industries,
 * agricultural clones get the healthy-living catalog automatically.
 */
export const entityTypeConfigs: EntityTypeConfig[] = Object.values(getEntityTypes()).map((entry) => ({
  id: entry.id as EntityType,
  ...getVisual(entry.id),
  label: entry.name,
  description: entry.description ?? '',
}))

const FALLBACK_CONFIG: EntityTypeConfig = {
  id: 'other',
  ...TYPE_VISUALS.other,
  label: 'Other',
  description: 'Organizations that do not fit a single category above',
}

export const getEntityTypeConfig = (type: EntityType | string): EntityTypeConfig => {
  // Raw id first (vertical preset ids like 'organic_farm'), then legacy-resolved industry id
  const direct = entityTypeConfigs.find((config) => config.id === type)
  if (direct) return direct
  const resolved = resolveEntityType(type)
  return entityTypeConfigs.find((config) => config.id === resolved) ?? FALLBACK_CONFIG
}

/** i18n label for an entity type — locales `modules.entities.types.<id>`, catalog name fallback. */
export function useEntityTypeLabel(): (type: EntityType | string) => string {
  const t = useTranslations('modules.entities')
  return useCallback(
    (type: EntityType | string) => {
      const config = getEntityTypeConfig(type)
      const key = `types.${config.id}`
      return t.has(key) ? t(key) : config.label
    },
    [t]
  )
}

/** i18n description for an entity type — locales `modules.entities.types.<id>Desc` fallback. */
export function useEntityTypeDescription(): (type: EntityType | string) => string {
  const t = useTranslations('modules.entities')
  return useCallback(
    (type: EntityType | string) => {
      const config = getEntityTypeConfig(type)
      const key = `types.${config.id}Desc`
      return t.has(key) ? t(key) : config.description
    },
    [t]
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
  const getLabel = useEntityTypeLabel()
  const Icon = config.icon
  const label = getLabel(type)

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
        <span className="text-sm font-medium">{label}</span>
      </div>
    )
  }

  return (
    <div className={containerClasses} title={label}>
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
  const getLabel = useEntityTypeLabel()
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
      <span>{getLabel(type)}</span>
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
  const getLabel = useEntityTypeLabel()
  const getDescription = useEntityTypeDescription()

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
              <div className="font-medium text-sm truncate">{getLabel(config.id)}</div>
              <div
                className={cn(
                  'text-xs truncate',
                  isSelected ? 'text-white/80' : 'text-muted-foreground'
                )}
              >
                {getDescription(config.id)}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default EntityTypeIcon
