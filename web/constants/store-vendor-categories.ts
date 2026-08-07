/** Shared marketplace category IDs — ring-platform.org vendor onboarding + store filters. */
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Cloud,
  FileText,
  Gem,
  Users,
  Bot,
  Wrench,
  Boxes,
} from 'lucide-react'

export const STORE_VENDOR_CATEGORY_IDS = [
  'ring-platform',
  'dev-kits',
  'ai-tools',
  'expert-services',
  'digital-templates',
  'learn',
  'community',
  'saas-assets',
] as const

export type StoreVendorCategoryId = (typeof STORE_VENDOR_CATEGORY_IDS)[number]

export const STORE_VENDOR_CATEGORY_META: Record<
  StoreVendorCategoryId,
  {
    /** Lucide icon component (calculator-style tiles) */
    LucideIcon: LucideIcon
    /** Accent hsl for selected tile border/glow */
    accent: string
    soft: string
    colorClass: string
  }
> = {
  'ring-platform': {
    LucideIcon: Gem,
    accent: 'hsl(262 83% 58%)',
    soft: 'hsl(262 83% 58% / 0.12)',
    colorClass: 'from-violet-500/20 to-indigo-500/20',
  },
  'dev-kits': {
    LucideIcon: Boxes,
    accent: 'hsl(199 89% 48%)',
    soft: 'hsl(199 89% 48% / 0.12)',
    colorClass: 'from-blue-500/20 to-cyan-500/20',
  },
  'ai-tools': {
    LucideIcon: Bot,
    accent: 'hsl(280 67% 52%)',
    soft: 'hsl(280 67% 52% / 0.12)',
    colorClass: 'from-purple-500/20 to-fuchsia-500/20',
  },
  'expert-services': {
    LucideIcon: Wrench,
    accent: 'hsl(32 95% 44%)',
    soft: 'hsl(32 95% 44% / 0.12)',
    colorClass: 'from-amber-500/20 to-orange-500/20',
  },
  'digital-templates': {
    LucideIcon: FileText,
    accent: 'hsl(215 16% 47%)',
    soft: 'hsl(215 16% 47% / 0.12)',
    colorClass: 'from-slate-500/20 to-gray-500/20',
  },
  learn: {
    LucideIcon: BookOpen,
    accent: 'hsl(160 84% 39%)',
    soft: 'hsl(160 84% 39% / 0.12)',
    colorClass: 'from-emerald-500/20 to-teal-500/20',
  },
  community: {
    LucideIcon: Users,
    accent: 'hsl(330 81% 60%)',
    soft: 'hsl(330 81% 60% / 0.12)',
    colorClass: 'from-pink-500/20 to-rose-500/20',
  },
  'saas-assets': {
    LucideIcon: Cloud,
    accent: 'hsl(204 90% 53%)',
    soft: 'hsl(204 90% 53% / 0.12)',
    colorClass: 'from-sky-500/20 to-blue-500/20',
  },
}
