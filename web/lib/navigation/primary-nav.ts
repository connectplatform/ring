/**
 * Primary nav data contract (L1 community default).
 * L2 packs overwrite this file (slots/hrefs/icons). L3 overwrites primary-nav-overlay.ts
 * and locales — never chrome. home.preset does not select the menu.
 * Mobile [...] platform modules: lib/navigation/platform-menu.ts + ring-config.navigation.platformMenu.
 */
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { PRIMARY_NAV_OVERLAY } from '@/lib/navigation/primary-nav-overlay'

export type PrimaryNavActiveMatch = 'pathname' | 'pathname+query'

export type PrimaryNavHrefItem = {
  id: string
  kind: 'href'
  href: (locale: Locale) => string
  labelKeys: string[]
  icon: string
  activeMatch?: PrimaryNavActiveMatch
}

export type PrimaryNavDocsOrAdminItem = {
  id: 'docsOrAdmin'
  kind: 'docs-or-admin'
  docsHref: (locale: Locale) => string
  labelKeysDocs: string[]
  labelKeysAdmin: string[]
  iconDocs: string
  iconAdmin: string
}

export type PrimaryNavOverflowItem = {
  id: 'overflow'
  kind: 'overflow-menu'
  labelKeys: string[]
  icon: string
}

export type PrimaryNavMobileItem =
  | PrimaryNavHrefItem
  | PrimaryNavDocsOrAdminItem
  | PrimaryNavOverflowItem

export type PrimaryNavManifest = {
  mobile: PrimaryNavMobileItem[]
  desktop: PrimaryNavHrefItem[]
  add: { kind: 'opportunity-types' }
}

const BASE_MANIFEST: PrimaryNavManifest = {
  mobile: [
    {
      id: 'opportunities',
      kind: 'href',
      href: (locale) => ROUTES.OPPORTUNITIES(locale),
      labelKeys: ['opportunities'],
      icon: 'briefcase',
      activeMatch: 'pathname',
    },
    {
      id: 'entities',
      kind: 'href',
      href: (locale) => ROUTES.ENTITIES(locale),
      labelKeys: ['entities'],
      icon: 'users',
      activeMatch: 'pathname',
    },
    {
      id: 'docsOrAdmin',
      kind: 'docs-or-admin',
      docsHref: (locale) => ROUTES.DOCS(locale),
      labelKeysDocs: ['docs'],
      labelKeysAdmin: ['admin.label'],
      iconDocs: 'file-text',
      iconAdmin: 'ellipsis',
    },
    {
      id: 'overflow',
      kind: 'overflow-menu',
      labelKeys: ['menu.title'],
      icon: 'more-horizontal',
    },
  ],
  desktop: [
    {
      id: 'entities',
      kind: 'href',
      href: (locale) => ROUTES.ENTITIES(locale),
      labelKeys: ['entities'],
      icon: 'users',
      activeMatch: 'pathname',
    },
    {
      id: 'opportunities',
      kind: 'href',
      href: (locale) => ROUTES.OPPORTUNITIES(locale),
      labelKeys: ['opportunities'],
      icon: 'briefcase',
      activeMatch: 'pathname',
    },
    {
      id: 'store',
      kind: 'href',
      href: (locale) => ROUTES.STORE(locale),
      labelKeys: ['store'],
      icon: 'store',
      activeMatch: 'pathname',
    },
    {
      id: 'docs',
      kind: 'href',
      href: (locale) => ROUTES.DOCS(locale),
      labelKeys: ['docs', 'sidebar.documentation'],
      icon: 'file-text',
      activeMatch: 'pathname',
    },
  ],
  add: { kind: 'opportunity-types' },
}

function applyHrefOverlay(item: PrimaryNavHrefItem): PrimaryNavHrefItem {
  const icon = PRIMARY_NAV_OVERLAY.iconById?.[item.id] ?? item.icon
  const labelKeys = PRIMARY_NAV_OVERLAY.labelKeysById?.[item.id] ?? item.labelKeys
  const href = PRIMARY_NAV_OVERLAY.hrefById?.[item.id] ?? item.href
  return { ...item, icon, labelKeys, href }
}

function applyMobileOverlay(item: PrimaryNavMobileItem): PrimaryNavMobileItem {
  if (item.kind === 'href') return applyHrefOverlay(item)
  if (item.kind === 'docs-or-admin') {
    return {
      ...item,
      iconDocs: PRIMARY_NAV_OVERLAY.iconById?.docs ?? item.iconDocs,
      iconAdmin: PRIMARY_NAV_OVERLAY.iconById?.admin ?? item.iconAdmin,
    }
  }
  return {
    ...item,
    icon: PRIMARY_NAV_OVERLAY.iconById?.[item.id] ?? item.icon,
    labelKeys: PRIMARY_NAV_OVERLAY.labelKeysById?.[item.id] ?? item.labelKeys,
  }
}

export function getPrimaryNavManifest(): PrimaryNavManifest {
  return {
    mobile: BASE_MANIFEST.mobile.map(applyMobileOverlay),
    desktop: BASE_MANIFEST.desktop.map(applyHrefOverlay),
    add: BASE_MANIFEST.add,
  }
}

export function resolveNavLabel(
  t: (key: string) => string,
  keys: string[],
): string {
  for (const key of keys) {
    try {
      const value = t(key)
      if (value && value !== key) return value
    } catch {
      /* missing key */
    }
  }
  return keys[0] ?? ''
}

export function navHrefIsActive(
  href: string,
  pathname: string,
  search: string,
  isPathActive: (pathOnly: string) => boolean,
  activeMatch: PrimaryNavActiveMatch = 'pathname',
): boolean {
  const pathOnly = href.split('?')[0] ?? href
  if (activeMatch === 'pathname+query') {
    const want = new URLSearchParams(href.split('?')[1] ?? '').get('types') || ''
    const have = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
      'types',
    ) || ''
    const typesOk = !want || have.split(',').includes(want)
    return isPathActive(pathOnly) && typesOk
  }
  return isPathActive(pathOnly)
}
