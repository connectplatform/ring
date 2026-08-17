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
