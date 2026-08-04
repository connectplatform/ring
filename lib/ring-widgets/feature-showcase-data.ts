/**
 * Feature Showcase Data Layer — SSOT for feature-domain i18n data.
 *
 * Founder tab features are sourced from locale JSON files (pages.json →
 * home.hero.featureSystems.items) via next-intl useTranslations()
 * with .raw() for array values — the ring-native client-side i18n pattern.
 *
 * Developer tab features are sourced from the existing welcome-features.ts
 * TypeScript data with built-in locale support (en/uk/ru).
 *
 * Icons: lucide-react outlined (no emoji).
 */
'use client'

import { useMemo, type ComponentType } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import type { LucideProps } from 'lucide-react'
import {
  Store,
  Building2,
  Wallet,
  Gem,
  MessageCircle,
  Target,
  Palette,
  Bot,
  Factory,
  Layers,
  Database,
  KeyRound,
  Radio,
  CreditCard,
  Video,
  Shield,
  Code2,
  Cable,
  Wrench,
} from 'lucide-react'
import {
  getWelcomeFeatureExplorerCopy,
  type WelcomeFeatureItem,
} from '@/lib/ring-widgets/welcome-features'

export type AudienceTab = 'founder' | 'developer'

export type ShowcaseIcon = ComponentType<LucideProps>

export interface FeatureSystemItem {
  title: string
  description: string
  terms: string[]
  purpose: string
  benefits: string
}

export interface ShowcaseFeature {
  id: string
  icon: ShowcaseIcon
  title: string
  description: string
  purpose: string
  benefits: string
  terms: string[]
  href: string
}

const FOUNDER_FEATURE_META: Array<{ id: string; icon: ShowcaseIcon; href: string }> = [
  { id: 'store', icon: Store, href: '/docs/features/store' },
  { id: 'entities', icon: Building2, href: '/docs/features/entities' },
  { id: 'wallet', icon: Wallet, href: '/docs/features/wallet' },
  { id: 'staking', icon: Gem, href: '/docs/features/staking' },
  { id: 'messaging', icon: MessageCircle, href: '/docs/features/messaging' },
  { id: 'opportunities', icon: Target, href: '/docs/features/opportunities' },
  { id: 'nft', icon: Palette, href: '/docs/features/nft-market' },
  { id: 'aiMatcher', icon: Bot, href: '/docs/features/opportunities' },
  { id: 'erp', icon: Factory, href: '/docs/features/erp' },
]

const DEVELOPER_ICON_BY_ID: Record<string, ShowcaseIcon> = {
  architecture: Layers,
  'data-model': Database,
  authentication: KeyRound,
  tunnel: Radio,
  'payment-conductor': CreditCard,
  'video-conductor': Video,
  security: Shield,
  api: Code2,
  mcp: Cable,
}

export function useFounderFeatures(): ShowcaseFeature[] {
  const t = useTranslations('pages.home.hero.featureSystems.items')

  return useMemo(() => {
    return FOUNDER_FEATURE_META.map(({ id, icon, href }) => {
      const title = t(`${id}.title`)
      const description = t(`${id}.description`)
      const purpose = t(`${id}.purpose`)
      const benefits = t(`${id}.benefits`)
      const terms = (t.raw(`${id}.terms`) as string[]) ?? []

      return { id, icon, title, description, purpose, benefits, terms, href }
    })
  }, [t])
}

const DEVELOPER_FEATURE_IDS: ReadonlyArray<string> = [
  'architecture',
  'data-model',
  'authentication',
  'tunnel',
  'payment-conductor',
  'video-conductor',
  'security',
  'api',
  'mcp',
]

const DEVELOPER_TERMS: Record<string, string[]> = {
  architecture: ['System Design', 'Data Flow', 'Backend', 'Scalability'],
  'data-model': ['PostgreSQL', 'JSONB', 'PostGIS', 'Schema v4'],
  authentication: ['Auth.js v5', 'OAuth', 'Wallet Sign-in', 'Magic Links'],
  tunnel: ['WebSocket', 'SSE', 'Broker', 'React Hooks'],
  'payment-conductor': ['Ledger', 'Webhooks', 'Idempotent', 'Checkout'],
  'video-conductor': ['Generative AI', 'Pipeline', 'Draft→Prod', 'MP4'],
  security: ['RBAC', 'Confidential', 'Encryption', 'Hardening'],
  api: ['REST API', '132 Routes', 'Handlers', 'TypeScript'],
  mcp: ['MCP Gateway', 'Cursor', 'CI Tools', 'Automation'],
}

function buildItemMap(
  sections: ReadonlyArray<{ label: string; items: ReadonlyArray<WelcomeFeatureItem> }>,
): Map<string, WelcomeFeatureItem> {
  const map = new Map<string, WelcomeFeatureItem>()
  for (const section of sections) {
    for (const item of section.items) {
      map.set(item.id, item)
    }
  }
  return map
}

export function useDeveloperFeatures(): ShowcaseFeature[] {
  const locale = useLocale() as Locale
  const copy = getWelcomeFeatureExplorerCopy(locale)
  const developerMap = useMemo(() => buildItemMap(copy.developer), [copy.developer])

  return useMemo(() => {
    return DEVELOPER_FEATURE_IDS.map((id) => {
      const item = developerMap.get(id)
      return {
        id,
        icon: DEVELOPER_ICON_BY_ID[id] ?? Wrench,
        title: item?.title ?? id,
        description: item?.description ?? '',
        purpose: '',
        benefits: '',
        terms: DEVELOPER_TERMS[id] ?? [],
        href: item?.href ?? `/docs/features/${id}`,
      }
    })
  }, [developerMap])
}

export function useShowcaseFeatures(tab: AudienceTab): ShowcaseFeature[] {
  const founder = useFounderFeatures()
  const developer = useDeveloperFeatures()
  return tab === 'founder' ? founder : developer
}
