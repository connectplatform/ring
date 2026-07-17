import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Calendar,
  GraduationCap,
  HandHeart,
  Package,
  Users2,
} from 'lucide-react'
import {
  getOpportunityFormTypePreset,
  type OpportunityFormTypePreset,
} from '@/features/opportunities/lib/opportunity-type-presets'

/** Feed-card visual tone — borders/colors from form-type SSOT; icons for feed scanning. */
export type OpportunityFeedTypeTone = Pick<
  OpportunityFormTypePreset,
  'color' | 'bgColor' | 'borderColor' | 'textColor'
> & {
  icon: LucideIcon
  solidColor: string
}

const FEED_ICONS: Record<string, LucideIcon> = {
  offer: Briefcase,
  request: HandHeart,
  partnership: Users2,
  volunteer: HandHeart,
  mentorship: GraduationCap,
  resource: Package,
  event: Calendar,
  ring_customization: Briefcase,
  cv: GraduationCap,
}

const SOLID: Record<string, string> = {
  offer: 'bg-green-500',
  request: 'bg-blue-500',
  partnership: 'bg-purple-500',
  volunteer: 'bg-orange-500',
  mentorship: 'bg-indigo-500',
  resource: 'bg-teal-500',
  event: 'bg-pink-500',
  ring_customization: 'bg-violet-500',
  cv: 'bg-indigo-500',
}

export function getOpportunityFeedTypeTone(type: string): OpportunityFeedTypeTone {
  const preset = getOpportunityFormTypePreset(type)
  const fallback = getOpportunityFormTypePreset('offer')!
  const base = preset ?? fallback
  return {
    color: base.color,
    bgColor: base.bgColor,
    borderColor: base.borderColor,
    textColor: base.textColor,
    icon: FEED_ICONS[type] || FEED_ICONS.offer,
    solidColor: SOLID[type] || SOLID.offer,
  }
}
