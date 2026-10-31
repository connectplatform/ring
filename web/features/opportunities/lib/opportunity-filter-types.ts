import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Calendar,
  GraduationCap,
  HandHeart,
  Package,
  Plug2,
  Server,
  Sparkles,
  Trophy,
  Users2,
  Zap,
  Layers,
} from 'lucide-react'
import { OPPORTUNITY_FILTER_TYPE_IDS } from '@/features/opportunities/lib/opportunity-type-policy'

export type OpportunityFilterType = {
  id: string
  icon: LucideIcon
  color: string
}

type MessageLookup = {
  (key: string): string
  has: (key: string) => boolean
}

const PANEL_DEFAULT: OpportunityFilterType[] = [
  { id: 'request', icon: HandHeart, color: 'bg-blue-500' },
  { id: 'offer', icon: Briefcase, color: 'bg-green-500' },
  { id: 'cv', icon: Sparkles, color: 'bg-indigo-500' },
  {
    id: 'ring_customization',
    icon: Package,
    color: 'bg-gradient-to-r from-violet-500 to-purple-500',
  },
]

const ADVANCED_DEFAULT: OpportunityFilterType[] = [
  { id: 'offer', icon: Briefcase, color: 'bg-blue-500' },
  { id: 'request', icon: HandHeart, color: 'bg-green-500' },
  { id: 'partnership', icon: Users2, color: 'bg-purple-500' },
  { id: 'volunteer', icon: HandHeart, color: 'bg-orange-500' },
  { id: 'mentorship', icon: GraduationCap, color: 'bg-indigo-500' },
  { id: 'resource', icon: Package, color: 'bg-teal-500' },
  { id: 'event', icon: Calendar, color: 'bg-pink-500' },
  {
    id: 'ring_customization',
    icon: Package,
    color: 'bg-gradient-to-r from-violet-500 to-purple-500',
  },
]

const VERTICAL_VISUALS: Record<string, { icon: LucideIcon; color: string }> = {
  integration_request: { icon: Plug2, color: 'bg-blue-500' },
  publisher_offer: { icon: Layers, color: 'bg-emerald-500' },
  mcp_wanted: { icon: Server, color: 'bg-slate-500' },
  skillset_wanted: { icon: Sparkles, color: 'bg-indigo-500' },
  router_brief: { icon: Zap, color: 'bg-amber-500' },
  bounty: { icon: Trophy, color: 'bg-yellow-500' },
}

/** Pack filter ids when set; otherwise the community chip list for this panel. */
export function opportunityFilterTypes(variant: 'panel' | 'advanced'): OpportunityFilterType[] {
  if (OPPORTUNITY_FILTER_TYPE_IDS.length === 0) {
    return variant === 'panel' ? PANEL_DEFAULT : ADVANCED_DEFAULT
  }
  return OPPORTUNITY_FILTER_TYPE_IDS.map((id) => ({
    id,
    icon: VERTICAL_VISUALS[id]?.icon ?? Sparkles,
    color: VERTICAL_VISUALS[id]?.color ?? 'bg-primary',
  }))
}

export function opportunityTypeLabel(t: MessageLookup, id: string): string {
  const keys = [`types.${id}.title`, `type_selector.${id}.title`, id]
  for (const key of keys) {
    if (!t.has(key)) continue
    const value = t(key).trim()
    if (value) return value
  }
  return id
}
