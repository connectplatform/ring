import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import type { ComponentProps } from 'react'
import { defaultLocale, sharedPathnames, supportedLocales } from './shared'

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  pathnames: sharedPathnames,
  localePrefix: 'as-needed',
})

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)

export type Locale = (typeof routing.locales)[number]

export type AppHref = ComponentProps<typeof Link>['href']

/** Strip optional locale prefix from ROUTES.withLocale strings for next-intl Link/router. */
export function toAppHref(href: string): AppHref {
  const match = href.match(/^\/(en|uk|ru)(?=\/|$)/)
  const path = match ? href.slice(match[0].length) || '/' : href
  return path as AppHref
}

export type AppRouter = ReturnType<typeof useRouter>
export type AppPathname = ReturnType<typeof usePathname>

/**
 * Preferred locale switch: `router.replace(pathname, { locale })`.
 * Cast bridges next-intl’s strict `Pathname` union vs `usePathname()` return type.
 */
export function replaceLocalePath(
  router: AppRouter,
  pathname: AppPathname,
  locale: Locale,
): void {
  router.replace(pathname as Parameters<AppRouter['replace']>[0], { locale, scroll: false })
}

/** Same as {@link replaceLocalePath}. */
export function switchLocale(
  router: AppRouter,
  pathname: AppPathname,
  locale: Locale,
): void {
  replaceLocalePath(router, pathname, locale)
}
