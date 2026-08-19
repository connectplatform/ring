/**
 * Mobile avatar user-menu catalog (not the [...] platform menu).
 *
 * L1 default + feature gates. L3 clones order/hide/extend via
 * `ring-config.json` → `navigation.userMenu` (items / exclude / extra).
 * Chrome stays L1-only. Packs do not overwrite this file.
 */
import type { Locale } from '@/i18n/shared'
import { ROUTES, withLocale } from '@/constants/routes'
import { getSystemConfigSnapshot, readFeatureFlagPath } from '@/lib/ring-config-core'
import type { PlatformMenuConfig, PlatformMenuExtraItem } from '@/lib/ring-config-types'
import type { PlatformMenuCatalogEntry, ResolvedPlatformMenuItem } from '@/lib/navigation/platform-menu'

export type ResolvedUserMenuItem = ResolvedPlatformMenuItem

/** Community default — platform modules stay on the [...] menu. */
export const DEFAULT_USER_MENU_IDS: readonly string[] = [
  'profile',
  'wallet',
  'notifications',
  'messages',
  'cart',
  'favorites',
  'tasks',
  'settings',
]

const CATALOG: readonly PlatformMenuCatalogEntry[] = [
  {
    id: 'profile',
    labelKeys: ['profile'],
    descriptionKeys: ['menu.profile.description'],
    icon: 'user',
    href: (locale) => ROUTES.PROFILE(locale),
  },
  {
    id: 'wallet',
    labelKeys: ['wallet', 'mainNav.wallet'],
    descriptionKeys: ['menu.wallet.description'],
    icon: 'wallet',
    href: (locale) => ROUTES.WALLET(locale),
  },
  {
    id: 'notifications',
    labelKeys: ['notifications'],
    descriptionKeys: ['menu.notifications.description'],
    icon: 'bell',
    href: (locale) => `${ROUTES.PROFILE(locale)}?tab=notifications`,
  },
  {
    id: 'messages',
    labelKeys: ['messages'],
    descriptionKeys: ['menu.messages.description'],
    icon: 'message-circle',
    href: (locale) => ROUTES.MESSAGES(locale),
    featurePath: 'messaging',
  },
  {
    id: 'cart',
    labelKeys: ['cart', 'store'],
    descriptionKeys: ['menu.cart.description'],
    icon: 'shopping-cart',
    href: (locale) => ROUTES.CART(locale),
    featurePath: 'store',
  },
  {
    id: 'favorites',
    labelKeys: ['favorites'],
    descriptionKeys: ['menu.favorites.description'],
    icon: 'heart',
    href: (locale) => `${ROUTES.STORE(locale)}?filter=favorites`,
    featurePath: 'store',
  },
  {
    id: 'tasks',
    labelKeys: ['tasks'],
    descriptionKeys: ['menu.tasks.description'],
    icon: 'list-todo',
    href: (locale) => ROUTES.TASKS(locale),
  },
  {
    id: 'settings',
    labelKeys: ['settings'],
    descriptionKeys: ['menu.settings.description'],
    icon: 'settings',
    href: (locale) => ROUTES.SETTINGS(locale),
  },
]

function isCatalogEntryVisible(
  entry: PlatformMenuCatalogEntry,
  snap: { features?: unknown },
): boolean {
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

export function getUserMenuConfig(): PlatformMenuConfig {
  return getSystemConfigSnapshot().navigation?.userMenu ?? {}
}

export function getResolvedUserMenuItems(locale: Locale): ResolvedUserMenuItem[] {
  const snap = getSystemConfigSnapshot()
  const cfg = snap.navigation?.userMenu ?? {}
  const extras = cfg.extra ?? []
  const byId = new Map<string, PlatformMenuCatalogEntry>()
  for (const entry of CATALOG) byId.set(entry.id, entry)
  for (const extra of extras) byId.set(extra.id, extraToCatalog(extra))

  const exclude = new Set(cfg.exclude ?? [])
  const ordered = [...(cfg.items?.length ? cfg.items : DEFAULT_USER_MENU_IDS)]
  for (const extra of extras) {
    if (!ordered.includes(extra.id)) ordered.push(extra.id)
  }

  const out: ResolvedUserMenuItem[] = []
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
