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
 * @author LegioX Commander
 * @version 1.0.0
 */
'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import {
  getWelcomeFeatureExplorerCopy,
  type WelcomeFeatureItem,
} from '@/lib/ring-widgets/welcome-features'

/* ─────────── Types ─────────── */

export type AudienceTab = 'founder' | 'developer'

/** A feature item as stored in pages.json locale files */
export interface FeatureSystemItem {
  title: string
  description: string
  terms: string[]
  purpose: string
  benefits: string
}

/** Resolved feature for the gallery — combines locale data with display metadata */
export interface ShowcaseFeature {
  id: string
  emoji: string
  title: string
  description: string
  purpose: string
  benefits: string
  terms: string[]
  href: string
}

/* ─────────── Founder tab: resolved from pages.json via useTranslations ─────────── */

const FOUNDER_FEATURE_META: Array<{ id: string; emoji: string; href: string }> = [
  { id: 'store', emoji: '🏪', href: '/docs/features/store' },
  { id: 'entities', emoji: '🏢', href: '/docs/features/entities' },
  { id: 'wallet', emoji: '💰', href: '/docs/features/wallet' },
  { id: 'staking', emoji: '💎', href: '/docs/features/staking' },
  { id: 'messaging', emoji: '💬', href: '/docs/features/messaging' },
  { id: 'opportunities', emoji: '🎯', href: '/docs/features/opportunities' },
  { id: 'nft', emoji: '🎨', href: '/docs/features/nft-market' },
  { id: 'aiMatcher', emoji: '🤖', href: '/docs/features/opportunities' },
  { id: 'erp', emoji: '🏭', href: '/docs/features/erp' },
]

/** Hook providing the 9 founder-showcase features with full i18n support */
export function useFounderFeatures(): ShowcaseFeature[] {
  const t = useTranslations('pages.home.hero.featureSystems.items')

  return useMemo(() => {
    return FOUNDER_FEATURE_META.map(({ id, emoji, href }) => {
      const title = t(`${id}.title`)
      const description = t(`${id}.description`)
      const purpose = t(`${id}.purpose`)
      const benefits = t(`${id}.benefits`)
      const terms = (t.raw(`${id}.terms`) as string[]) ?? []

      return { id, emoji, title, description, purpose, benefits, terms, href }
    })
  }, [t])
}

/* ─────────── Developer tab: sourced from welcome-features.ts ─────────── */

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

/** Developer-tab feature terms — locale-driven via welcome-features descriptions */
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

/** Build a flat item map from welcome-features sections */
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

/** Hook providing the 9 developer-showcase features */
export function useDeveloperFeatures(): ShowcaseFeature[] {
  const locale = useLocale() as Locale
  const copy = getWelcomeFeatureExplorerCopy(locale)
  const developerMap = useMemo(() => buildItemMap(copy.developer), [copy.developer])

  return useMemo(() => {
    return DEVELOPER_FEATURE_IDS.map((id) => {
      const item = developerMap.get(id)
      return {
        id,
        emoji: item?.emoji ?? '🔧',
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

/** Resolve features for a given audience tab */
export function useShowcaseFeatures(tab: AudienceTab): ShowcaseFeature[] {
  const founder = useFounderFeatures()
  const developer = useDeveloperFeatures()
  const features = tab === 'founder' ? founder : developer
  return features
}
