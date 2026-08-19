/**
 * Mobile [...] platform-menu catalog (not the avatar user menu).
 *
 * L1 default + feature gates. L3 clones order/hide/extend via
 * `ring-config.json` → `navigation.platformMenu` (items / exclude / extra).
 * Packs do not overwrite this file — vertical defaults live in PACK.json.platformMenu
 * and are copied onto the clone ring-config by autonomous-clone / Mode A.
 * Chrome stays L1-only.
 */
import type { Locale } from '@/i18n/shared'
import { ROUTES, withLocale } from '@/constants/routes'
import { getSystemConfigSnapshot, readFeatureFlagPath } from '@/lib/ring-config-core'
import type { PlatformMenuConfig, PlatformMenuExtraItem } from '@/lib/ring-config-types'

export type PlatformMenuCatalogEntry = {
  id: string
  labelKeys: string[]
  descriptionKeys: string[]
  icon: string
  href: (locale: Locale) => string
  /**
   * Dot path under `features` (e.g. `store.enabled`, `web3.nftMarketplace`).
   * `readFeatureFlagPath` flattens boolean leaves: `features.entities: false`
   * still matches `entities.enabled`. Missing path = visible. Explicit `false` hides.
   */
  featurePath?: string
}

export type ResolvedPlatformMenuItem = {
  id: string
  href: string
  labelKeys: string[]
  descriptionKeys: string[]
  icon: string
}

/** Community default — user pages (wallet, messages, settings) stay on the avatar menu. */
export const DEFAULT_PLATFORM_MENU_IDS: readonly string[] = [
  'opportunities',
  'entities',
  'store',
  'nft',
  'games',
  'news',
  'docs',
]

const CATALOG: readonly PlatformMenuCatalogEntry[] = [
  {
    id: 'opportunities',
    labelKeys: ['opportunities'],
    descriptionKeys: ['menu.opportunities.description'],
    icon: 'briefcase',
    href: (locale) => ROUTES.OPPORTUNITIES(locale),
    featurePath: 'opportunities.enabled',
  },
  {
    id: 'entities',
    labelKeys: ['entities', 'mainNav.directory'],
    descriptionKeys: ['menu.entities.description'],
    icon: 'building',
    href: (locale) => ROUTES.ENTITIES(locale),
    featurePath: 'entities.enabled',
  },
  {
    id: 'store',
    labelKeys: ['store'],
    descriptionKeys: ['menu.store.description'],
    icon: 'store',
    href: (locale) => ROUTES.STORE(locale),
    featurePath: 'store.enabled',
  },
  {
    id: 'nft',
    labelKeys: ['nft'],
    descriptionKeys: ['menu.nft.description'],
    icon: 'sparkles',
    href: (locale) => ROUTES.NFT_MARKET(locale),
    featurePath: 'web3.nftMarketplace',
  },
  {
    id: 'games',
    labelKeys: ['games'],
    descriptionKeys: ['menu.games.description'],
    icon: 'gamepad',
    href: (locale) => ROUTES.GAMES(locale),
  },
  {
    id: 'news',
    labelKeys: ['mainNav.news', 'admin.news'],
    descriptionKeys: ['menu.news.description'],
    icon: 'newspaper',
    href: (locale) => ROUTES.NEWS(locale),
    featurePath: 'news.enabled',
  },
  {
    id: 'docs',
    labelKeys: ['docs', 'sidebar.documentation'],
    descriptionKeys: ['menu.docs.description'],
    icon: 'file-text',
    href: (locale) => ROUTES.DOCS(locale),
  },
  {
    id: 'live',
    labelKeys: ['mainNav.live'],
    descriptionKeys: ['menu.live.description'],
    icon: 'tv',
    href: (locale) => withLocale(locale, '/live-tv'),
  },
  {
    id: 'categories',
    labelKeys: ['mainNav.categories'],
    descriptionKeys: ['menu.categories.description'],
    icon: 'layout-grid',
    href: (locale) => ROUTES.NEWS_CATEGORIES(locale),
  },
  {
    id: 'roadmap',
    labelKeys: ['sidebar.roadmap'],
    descriptionKeys: ['menu.roadmap.description'],
    icon: 'map',
    href: (locale) => ROUTES.ROADMAP(locale),
    featurePath: 'roadmap.enabled',
  },
]

function isCatalogEntryVisible(entry: PlatformMenuCatalogEntry, snap: { features?: unknown }): boolean {
  if (!entry.featurePath) return true
  const fromFeatures = readFeatureFlagPath(snap.features, entry.featurePath)
  if (typeof fromFeatures === 'boolean') return fromFeatures
  const fromRoot = readFeatureFlagPath(snap, entry.featurePath)
  return fromRoot !== false
}

function localizeHref(locale: Locale, href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  const path = href.startsWith('/') ? href : `/${href}`
  return withLocale(locale, path)
}

function extraToCatalog(extra: PlatformMenuExtraItem): PlatformMenuCatalogEntry {
  return {
    id: extra.id,
    labelKeys: [extra.labelKey],
    descriptionKeys: extra.descriptionKey ? [extra.descriptionKey] : [],
    icon: extra.icon,
    href: (locale) => localizeHref(locale, extra.href),
  }
}

export function getPlatformMenuConfig(): PlatformMenuConfig {
  return getSystemConfigSnapshot().navigation?.platformMenu ?? {}
}

/**
 * Resolve the [...] platform menu for the active clone.
 * Order: `items` (or L1 default) minus `exclude` / `excludeIds`, plus `extra` ids not already listed.
 */
export function getResolvedPlatformMenuItems(
  locale: Locale,
  options?: { excludeIds?: readonly string[] },
): ResolvedPlatformMenuItem[] {
  const snap = getSystemConfigSnapshot()
  const cfg = snap.navigation?.platformMenu ?? {}
  const extras = cfg.extra ?? []
  const byId = new Map<string, PlatformMenuCatalogEntry>()
  for (const entry of CATALOG) byId.set(entry.id, entry)
  for (const extra of extras) byId.set(extra.id, extraToCatalog(extra))

  const exclude = new Set([...(cfg.exclude ?? []), ...(options?.excludeIds ?? [])])
  const ordered = [...(cfg.items?.length ? cfg.items : DEFAULT_PLATFORM_MENU_IDS)]
  for (const extra of extras) {
    if (!ordered.includes(extra.id)) ordered.push(extra.id)
  }

  const out: ResolvedPlatformMenuItem[] = []
  const seen = new Set<string>()
  for (const id of ordered) {
    if (seen.has(id) || exclude.has(id)) continue
    const entry = byId.get(id)
    if (!entry) continue
    if (!isCatalogEntryVisible(entry, snap)) continue
    seen.add(id)
    out.push({
      id: entry.id,
      href: entry.href(locale),
      labelKeys: entry.labelKeys,
      descriptionKeys: entry.descriptionKeys,
      icon: entry.icon,
    })
  }
  return out
}
