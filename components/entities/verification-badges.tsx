"use client"

import React from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Award, 
  Shield, 
  Star, 
  Crown, 
  Verified,
  Globe,
  Building2,
  Trophy,
  Zap,
  LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Entity, SerializedEntity } from '@/features/entities/types'

/**
 * Verification levels and their configurations
 */
export type VerificationLevel = 
  | 'unverified'
  | 'basic'
  | 'verified'
  | 'premium'
  | 'enterprise'
  | 'partner'

export interface VerificationConfig {
  level: VerificationLevel
  icon: LucideIcon
  label: string
  description: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  requirements: string[]
  benefits: string[]
}

// Comprehensive verification level configurations
export const verificationConfigs: VerificationConfig[] = [
  {
    level: 'unverified',
    icon: Building2,
    label: 'Unverified',
    description: 'Basic entity profile without verification',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    requirements: ['Complete basic profile information'],
    benefits: ['Basic profile visibility', 'Contact information display']
  },
  {
    level: 'basic',
    icon: CheckCircle,
    label: 'Basic Verified',
    description: 'Email and basic information verified',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    requirements: ['Email verification', 'Complete profile', 'Valid contact information'],
    benefits: ['Verified badge', 'Enhanced search visibility', 'Contact form access']
  },
  {
    level: 'verified',
    icon: Verified,
    label: 'Verified',
    description: 'Business documents and identity verified',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    requirements: ['Business registration documents', 'Identity verification', 'Address confirmation'],
    benefits: ['Trust badge', 'Priority in search results', 'Partnership opportunities']
  },
  {
    level: 'premium',
    icon: Award,
    label: 'Premium Verified',
    description: 'Enhanced verification with certifications',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    requirements: ['Industry certifications', 'Quality standards compliance', 'Customer references'],
    benefits: ['Premium badge', 'Featured listings', 'Advanced analytics', 'Priority support']
  },
  {
    level: 'enterprise',
    icon: Crown,
    label: 'Enterprise',
    description: 'Large-scale enterprise verification',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    requirements: ['Enterprise-grade compliance', 'Financial verification', 'Security audits'],
    benefits: ['Enterprise badge', 'Dedicated account manager', 'Custom integrations', 'SLA guarantees']
  },
  {
    level: 'partner',
    icon: Trophy,
    label: 'Ring Partner',
    description: 'Official Ring Platform partner',
    color: 'rose',
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    requirements: ['Partnership agreement', 'Platform integration', 'Performance metrics'],
    benefits: ['Partner badge', 'Co-marketing opportunities', 'Revenue sharing', 'Exclusive features']
  }
]

/**
 * Get verification configuration by level
 */
export const getVerificationConfig = (level: VerificationLevel): VerificationConfig => {
  return verificationConfigs.find(config => config.level === level) || verificationConfigs[0]
}

/**
 * Determine entity verification level based on entity data
 */
export const determineVerificationLevel = (entity: Entity | SerializedEntity): VerificationLevel => {
  // Check for Ring Partner status (highest level)
  if (entity.partnerships?.some(p => p.toLowerCase().includes('ring') || p.toLowerCase().includes('platform'))) {
    return 'partner'
  }
  
  // Check for enterprise indicators
  if (entity.employeeCount && entity.employeeCount > 500) {
    if (entity.certifications && entity.certifications.length >= 3) {
      return 'enterprise'
    }
  }
  
  // Check for premium verification
  if (entity.certifications && entity.certifications.length >= 2 && entity.partnerships && entity.partnerships.length > 0) {
    return 'premium'
  }
  
  // Check for basic verification
  if (entity.certifications && entity.certifications.length > 0) {
    return 'verified'
  }
  
  // Check for basic profile completion
  if (entity.contactEmail && entity.phoneNumber && entity.website) {
    return 'basic'
  }
  
  return 'unverified'
}

/**
 * Verification Badge Component
 */
interface VerificationBadgeProps {
  entity: Entity | SerializedEntity
  size?: 'sm' | 'md' | 'lg'
  variant?: 'badge' | 'icon' | 'full'
  showTooltip?: boolean
  className?: string
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  entity,
  size = 'md',
  variant = 'badge',
  showTooltip = true,
  className
}) => {
  const t = useTranslations('modules.entities.verification')
  const level = determineVerificationLevel(entity)
  const config = getVerificationConfig(level)
  const Icon = config.icon

  const sizeClasses = {
    sm: variant === 'icon' ? 'w-4 h-4' : 'px-2 py-0.5 text-xs',
    md: variant === 'icon' ? 'w-5 h-5' : 'px-2.5 py-1 text-sm',
    lg: variant === 'icon' ? 'w-6 h-6' : 'px-3 py-1.5 text-base'
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  if (level === 'unverified' && variant !== 'full') {
    return null // Don't show badge for unverified entities unless explicitly requested
  }

  if (variant === 'icon') {
    return (
      <div 
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          config.bgColor,
          sizeClasses[size],
          className
        )}
        title={showTooltip ? `${config.label}: ${config.description}` : undefined}
      >
        <Icon className={cn(iconSizeClasses[size], config.textColor)} />
      </div>
    )
  }

  if (variant === 'full') {
    return (
      <div className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2',
        config.bgColor,
        config.borderColor,
        className
      )}>
        <Icon className={cn('w-5 h-5', config.textColor)} />
        <div>
          <div className={cn('font-medium text-sm', config.textColor)}>
            {config.label}
          </div>
          <div className={cn('text-xs opacity-80', config.textColor)}>
            {config.description}
          </div>
        </div>
      </div>
    )
  }

  // Default badge variant
  return (
    <Badge 
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        config.bgColor,
        config.textColor,
        config.borderColor,
        'border',
        sizeClasses[size],
        className
      )}
      // title={showTooltip ? `${config.label}: ${config.description}` : undefined}
    >
      <Icon className={iconSizeClasses[size]} />
      {config.label}
    </Badge>
  )
}

/**
 * Verification Status Component with detailed information
 */
interface VerificationStatusProps {
  entity: Entity | SerializedEntity
  showRequirements?: boolean
  showBenefits?: boolean
  className?: string
}

export const VerificationStatus: React.FC<VerificationStatusProps> = ({
  entity,
  showRequirements = false,
  showBenefits = false,
  className
}) => {
  const t = useTranslations('modules.entities.verification')
  const level = determineVerificationLevel(entity)
  const config = getVerificationConfig(level)
  const Icon = config.icon

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current Status */}
      <div className={cn(
        'flex items-center gap-3 p-4 rounded-lg border',
        config.bgColor,
        config.borderColor
      )}>
        <Icon className={cn('w-8 h-8', config.textColor)} />
        <div className="flex-1">
          <h3 className={cn('font-semibold text-lg', config.textColor)}>
            {config.label}
          </h3>
          <p className={cn('text-sm opacity-90', config.textColor)}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Requirements */}
      {showRequirements && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">
            {t('requirements')}
          </h4>
          <ul className="space-y-1">
            {config.requirements.map((requirement, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {requirement}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Benefits */}
      {showBenefits && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">
            {t('benefits')}
          </h4>
          <ul className="space-y-1">
            {config.benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-amber-500" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Verification Progress Component
 */
interface VerificationProgressProps {
  entity: Entity | SerializedEntity
  targetLevel?: VerificationLevel
  className?: string
}

export const VerificationProgress: React.FC<VerificationProgressProps> = ({
  entity,
  targetLevel = 'verified',
  className
}) => {
  const t = useTranslations('modules.entities.verification')
  const currentLevel = determineVerificationLevel(entity)
  const currentConfig = getVerificationConfig(currentLevel)
  const targetConfig = getVerificationConfig(targetLevel)
  
  const levelOrder: VerificationLevel[] = ['unverified', 'basic', 'verified', 'premium', 'enterprise', 'partner']
  const currentIndex = levelOrder.indexOf(currentLevel)
  const targetIndex = levelOrder.indexOf(targetLevel)
  const progress = Math.min((currentIndex / targetIndex) * 100, 100)

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{t('verificationProgress')}</h4>
        <span className="text-sm text-muted-foreground">
          {Math.round(progress)}% {t('complete')}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={cn('h-2 rounded-full transition-all duration-300', currentConfig.bgColor.replace('bg-', 'bg-'))}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Current and Target Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <currentConfig.icon className={cn('w-4 h-4', currentConfig.textColor)} />
          <span>{currentConfig.label}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{t('target')}:</span>
          <targetConfig.icon className="w-4 h-4" />
          <span>{targetConfig.label}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Verification Level Selector Component
 */
interface VerificationLevelSelectorProps {
  selectedLevel: VerificationLevel
  onLevelChange: (level: VerificationLevel) => void
  availableLevels?: VerificationLevel[]
  className?: string
}

export const VerificationLevelSelector: React.FC<VerificationLevelSelectorProps> = ({
  selectedLevel,
  onLevelChange,
  availableLevels = ['unverified', 'basic', 'verified', 'premium'],
  className
}) => {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {availableLevels.map((level) => {
        const config = getVerificationConfig(level)
        const Icon = config.icon
        const isSelected = selectedLevel === level
        
        return (
          <button
            key={level}
            onClick={() => onLevelChange(level)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              isSelected 
                ? `${config.bgColor} ${config.textColor} ${config.borderColor} border-2` 
                : 'border-border hover:border-border/80 hover:bg-muted/50'
            )}
          >
            <Icon className={cn(
              'w-5 h-5',
              isSelected ? config.textColor : 'text-muted-foreground'
            )} />
            <div className="flex-1 min-w-0">
              <div className={cn(
                'font-medium text-sm',
                isSelected ? config.textColor : 'text-foreground'
              )}>
                {config.label}
              </div>
              <div className={cn(
                'text-xs truncate',
                isSelected ? `${config.textColor} opacity-80` : 'text-muted-foreground'
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

export default VerificationBadge
