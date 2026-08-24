/**
 * Locale routing table only — safe for proxy.ts / middleware.
 *
 * Do not import `next-intl/navigation` here. `createNavigation()` pulls
 * getRequestConfig → overlay registry, and Turbopack then compiles
 * `@/features/<clone>/i18n` into the middleware graph (Module not found
 * whenever L3 overlay files are briefly absent during compose rematch).
 */
import { defineRouting } from 'next-intl/routing'
import { defaultLocale, sharedPathnames, supportedLocales } from './shared'

export const routing = defineRouting({
  locales: supportedLocales,
  defaultLocale,
  pathnames: sharedPathnames,
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]
