import { routing } from '@/i18n/routing'
import type { Locale } from '@/lib/locale-config'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  editorContentLocale,
  intlDateLocale,
  localeDisplayLabel,
  localeFlagEmoji,
  localeNativeTitle,
  openGraphAlternateLocaleTags,
  openGraphLocaleTag,
  paymentDisplayLocale,
  pickLocaleText,
  getLocaleSelectOptions,
} from '@/lib/locale-config'

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  editorContentLocale,
  getLocaleSelectOptions,
  intlDateLocale,
  localeDisplayLabel,
  localeFlagEmoji,
  localeNativeTitle,
  openGraphAlternateLocaleTags,
  openGraphLocaleTag,
  paymentDisplayLocale,
  pickLocaleText,
}
export type { Locale }

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365

/** next-intl middleware cookie — must stay in sync with ring-locale for as-needed prefix. */
export const NEXT_INTL_LOCALE_COOKIE = 'NEXT_LOCALE'

export function persistRingLocalePreference(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ring-locale', locale)
  const cookieSuffix = `path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`
  document.cookie = `ring-locale=${locale}; ${cookieSuffix}`
  // Dual-write so bare /path (localePrefix as-needed) does not fall through to Accept-Language
  document.cookie = `${NEXT_INTL_LOCALE_COOKIE}=${locale}; ${cookieSuffix}`
}

export function nextLocaleInRoutingOrder(current: Locale): Locale {
  const order = routing.locales as readonly Locale[]
  const i = Math.max(0, order.indexOf(current))
  return order[(i + 1) % order.length] ?? DEFAULT_LOCALE
}
