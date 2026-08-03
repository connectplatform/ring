import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'
import type { ComponentProps } from 'react'
import { defaultLocale, sharedPathnames, supportedLocales } from './shared'
import { stripLocalePrefix } from '@/lib/pathname-without-locale'

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  pathnames: sharedPathnames,
  localePrefix: 'as-needed',
})

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing)

export type Locale = (typeof routing.locales)[number]

export type AppHref = ComponentProps<typeof Link>['href']

/**
 * Strip optional locale prefix from ROUTES.withLocale strings for next-intl Link/router.
 * Must cover all SUPPORTED_LOCALES (en/uk/ru/es/de) — hardcoding en|uk|ru caused /de/de and /es/es.
 */
export function toAppHref(href: string): AppHref {
  const [pathPart, query = ''] = href.split('?')
  const path = stripLocalePrefix(pathPart || '/')
  return (query ? `${path}?${query}` : path) as AppHref
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
