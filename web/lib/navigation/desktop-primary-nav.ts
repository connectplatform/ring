/**
 * L1 chrome helper — packs overwrite primary-nav.ts, never this file.
 * Rail, synced layout, and overlay aside all resolve desktop slots here.
 */
import type { Locale } from '@/i18n/shared'
import { ROUTES, withLocale } from '@/constants/routes'
import {
  getPrimaryNavManifest,
  navHrefIsActive,
  resolveNavLabel,
} from '@/lib/navigation/primary-nav'
import { getPresetPack } from '@/lib/ring-config-core'
import { getResolvedPlatformMenuItems } from '@/lib/navigation/platform-menu'

export type ResolvedDesktopPrimaryNavItem = {
  id: string
  href: string
  label: string
  icon: string
  active: boolean
}

export function sidebarPathIsActive(
  pathname: string,
  href: string,
  locale: Locale,
): boolean {
  const pathOnly = href.split('?')[0] ?? href
  const home = ROUTES.HOME(locale)
  const docs = ROUTES.DOCS(locale)
  const news = ROUTES.NEWS(locale)
  const newsCategories = ROUTES.NEWS_CATEGORIES(locale)
  const newsCategoryBase = withLocale(locale, '/news/category')

  if (pathOnly === home) return pathname === home || pathname === `${home}/`

  if (pathOnly === docs) {
    return pathname === docs || pathname === `${docs}/`
  }

  if (pathOnly === newsCategories) {
    return (
      pathname === newsCategories ||
      pathname.startsWith(`${newsCategories}/`) ||
      pathname === newsCategoryBase ||
      pathname.startsWith(`${newsCategoryBase}/`)
    )
  }

  if (pathOnly === news) {
    if (pathname === news || pathname === `${news}/`) return true
    if (!pathname.startsWith(`${news}/`)) return false
    const rest = pathname.slice(news.length + 1)
    if (rest === 'categories' || rest.startsWith('categories/')) return false
    if (rest === 'category' || rest.startsWith('category/')) return false
    return true
  }

  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`)
}

export function resolveDesktopPrimaryNav(
  locale: Locale,
  tNav: (key: string) => string,
  pathname: string,
  search: string,
): ResolvedDesktopPrimaryNavItem[] {
  return getPrimaryNavManifest().desktop.map((item) => {
    const href = item.href(locale)
    return {
      id: item.id,
      href,
      label: resolveNavLabel(tNav, item.labelKeys),
      icon: item.icon,
      active: navHrefIsActive(
        href,
        pathname,
        search,
        (pathOnly) => sidebarPathIsActive(pathname, pathOnly, locale),
        item.activeMatch,
      ),
    }
  })
}

/**
 * Evolvement pack hides empire aside groups. Surface overflow catalog (five
 * systems + practitioners, minus ids already on the desktop rail) as aside-only.
 * Other packs keep their own desktop slots and must not inherit this list.
 */
export function resolvePackAsideNav(
  locale: Locale,
  tNav: (key: string) => string,
  pathname: string,
): ResolvedDesktopPrimaryNavItem[] {
  if (getPresetPack() !== 'evolvement') return []
  const desktop = getPrimaryNavManifest().desktop
  const skipIds = new Set(desktop.map((item) => item.id))
  const skipHrefs = new Set(desktop.map((item) => item.href(locale)))
  return getResolvedPlatformMenuItems(locale)
    .filter((item) => !skipIds.has(item.id) && !skipHrefs.has(item.href))
    .map((item) => ({
      id: item.id,
      href: item.href,
      label: resolveNavLabel(tNav, item.labelKeys),
      icon: item.icon,
      active: sidebarPathIsActive(pathname, item.href, locale),
    }))
}
