'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  Target,
  Users,
  Sparkles,
  MessageSquare,
  Briefcase,
  Crown,
  TrendingUp,
  Zap,
} from 'lucide-react'

export type OpportunityFormTypeKey =
  | 'request'
  | 'offer'
  | 'partnership'
  | 'volunteer'
  | 'mentorship'
  | 'resource'
  | 'event'
  | 'ring_customization'
  | 'cv'

export interface OpportunityFormTypePreset {
  id: OpportunityFormTypeKey
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  icon: LucideIcon
  /** i18n key under modules.opportunities.types.{id} */
  titleKey: string
  descriptionKey: string
}

/** Visual presets for add-opportunity form header (client-safe SSOT). */
export const opportunityFormTypePresets: Record<
  Exclude<OpportunityFormTypeKey, 'cv' | 'ring_customization'>,
  OpportunityFormTypePreset
> = {
  request: {
    id: 'request',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Target,
    titleKey: 'request.title',
    descriptionKey: 'request.description',
  },
  offer: {
    id: 'offer',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
    icon: Users,
    titleKey: 'offer.title',
    descriptionKey: 'offer.description',
  },
  partnership: {
    id: 'partnership',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    textColor: 'text-purple-700 dark:text-purple-300',
    icon: Sparkles,
    titleKey: 'partnership.title',
    descriptionKey: 'partnership.description',
  },
  volunteer: {
    id: 'volunteer',
    color: 'from-red-500 to-pink-500',
    bgColor: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-700 dark:text-red-300',
    icon: Users,
    titleKey: 'volunteer.title',
    descriptionKey: 'volunteer.description',
  },
  mentorship: {
    id: 'mentorship',
    color: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    icon: Users,
    titleKey: 'mentorship.title',
    descriptionKey: 'mentorship.description',
  },
  resource: {
    id: 'resource',
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-700 dark:text-orange-300',
    icon: Target,
    titleKey: 'resource.title',
    descriptionKey: 'resource.description',
  },
  event: {
    id: 'event',
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
    icon: Calendar,
    titleKey: 'event.title',
    descriptionKey: 'event.description',
  },
}

export function getOpportunityFormTypePreset(
  type: string,
): OpportunityFormTypePreset | undefined {
  return opportunityFormTypePresets[type as keyof typeof opportunityFormTypePresets]
}

/** Keys for the fullscreen opportunity type picker (add flow). */
export type OpportunityTypeKey = 'ring_customization' | 'request' | 'cv' | 'offer'

export const OPPORTUNITY_SELECTOR_TYPE_ORDER: OpportunityTypeKey[] = [
  'request',
  'cv',
  'offer',
  'ring_customization',
]

export interface OpportunitySelectorTypePreset {
  icon: typeof Target
  accentIcon: typeof Target
  requiresMembership: boolean
  popular?: boolean
  examples: string[]
}

export const opportunitySelectorTypePresets: Record<
  OpportunityTypeKey,
  OpportunitySelectorTypePreset
> = {
  ring_customization: {
    icon: Zap,
    accentIcon: Crown,
    requiresMembership: true,
    popular: true,
    examples: ['platform_deployment', 'module_development', 'branding', 'ai_customization'],
  },
  request: {
    icon: MessageSquare,
    accentIcon: Target,
    requiresMembership: false,
    popular: true,
    examples: ['freelancer', 'service', 'advice'],
  },
  cv: {
    icon: Sparkles,
    accentIcon: TrendingUp,
    requiresMembership: false,
    popular: true,
    examples: ['developer_cv', 'portfolio', 'skills'],
  },
  offer: {
    icon: Briefcase,
    accentIcon: TrendingUp,
    requiresMembership: true,
    examples: ['job', 'contract', 'internship'],
  },
}
