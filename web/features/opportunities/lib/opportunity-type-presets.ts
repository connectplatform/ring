'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  Target,
  Users,
  Sparkles,
  Briefcase,
  Crown,
  TrendingUp,
  Zap,
  Clock,
  ShoppingCart,
  Trophy,
  FileSearch,
  KeyRound,
  BadgeCheck,
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
  | 'program'
  | 'scheduled_services'
  | 'collective_order'
  | 'bounty'
  | 'tender'
  | 'asset_rental'
  | 'job'

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
  Exclude<OpportunityFormTypeKey, 'cv'>,
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
  ring_customization: {
    id: 'ring_customization',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
    icon: Zap,
    titleKey: 'ring_customization.title',
    descriptionKey: 'ring_customization.description',
  },
  // Institution program / investment (offer clone)
  program: {
    id: 'program' as OpportunityFormTypeKey,
    color: 'from-indigo-500 to-violet-500',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
    icon: Target,
    titleKey: 'program.title',
    descriptionKey: 'program.description',
  },
  scheduled_services: {
    id: 'scheduled_services',
    color: 'from-sky-500 to-blue-500',
    bgColor: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20',
    borderColor: 'border-sky-200 dark:border-sky-800',
    textColor: 'text-sky-700 dark:text-sky-300',
    icon: Clock,
    titleKey: 'scheduled_services.title',
    descriptionKey: 'scheduled_services.description',
  },
  collective_order: {
    id: 'collective_order',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
    icon: ShoppingCart,
    titleKey: 'collective_order.title',
    descriptionKey: 'collective_order.description',
  },
  bounty: {
    id: 'bounty',
    color: 'from-yellow-500 to-lime-500',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-lime-50 dark:from-yellow-950/20 dark:to-lime-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    icon: Trophy,
    titleKey: 'bounty.title',
    descriptionKey: 'bounty.description',
  },
  tender: {
    id: 'tender',
    color: 'from-slate-500 to-zinc-500',
    bgColor: 'bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-950/20 dark:to-zinc-950/20',
    borderColor: 'border-slate-200 dark:border-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
    icon: FileSearch,
    titleKey: 'tender.title',
    descriptionKey: 'tender.description',
  },
  asset_rental: {
    id: 'asset_rental',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    icon: KeyRound,
    titleKey: 'asset_rental.title',
    descriptionKey: 'asset_rental.description',
  },
  job: {
    id: 'job',
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: BadgeCheck,
    titleKey: 'job.title',
    descriptionKey: 'job.description',
  },
}

export function getOpportunityFormTypePreset(
  type: string,
): OpportunityFormTypePreset | undefined {
  return opportunityFormTypePresets[type as keyof typeof opportunityFormTypePresets]
}

/** Keys for the Add Opportunity persona picker (public 2×2). */
export type OpportunityTypeKey =
  | 'request'
  | 'offer'

/** Legacy form/deep-link types still supported outside the picker. */
export type OpportunityLegacyPickerKey =
  | 'project_order'
  | 'ring_customization'
  | 'cv'
  | 'vendor_listing'
  | 'program'

export const OPPORTUNITY_SELECTOR_TYPE_ORDER: OpportunityTypeKey[] = [
  'request',
  'offer',
]

export type OpportunitySelectorNavigationKind = 'route' | 'opportunity-form'

export interface OpportunitySelectorTypePreset {
  icon: typeof Target
  accentIcon: typeof Target
  requiresMembership: boolean
  popular?: boolean
  examples: string[]
  /** How the tile navigates when clicked. */
  navigationKind: OpportunitySelectorNavigationKind
  /**
   * For opportunity-form: query type; for route: resolved in selector via ROUTES.
   * project_order → calculator; vendor_listing → vendor products/start.
   */
  formType?: string
}

export const opportunitySelectorTypePresets: Record<
  OpportunityTypeKey,
  OpportunitySelectorTypePreset
> = {
  request: {
    icon: Target,
    accentIcon: Sparkles,
    requiresMembership: false,
    popular: true,
    examples: ['service_request', 'help_wanted', 'community_need'],
    navigationKind: 'opportunity-form',
    formType: 'request',
  },
  offer: {
    icon: Users,
    accentIcon: TrendingUp,
    requiresMembership: false,
    popular: true,
    examples: ['job', 'service', 'collaboration'],
    navigationKind: 'opportunity-form',
    formType: 'offer',
  },
}

// TODO(legacy-picker): project_order / cv / vendor_listing / program / ring_customization
// remain creatable via deep link and admin tools; ring_customization continues to be
// auto-published from calculator project_orders. Packs overwrite this file for vertical pickers.
