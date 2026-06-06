import { routing } from '@/i18n/routing'
import type { Locale } from '@/lib/locale-config'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  editorContentLocale,
  intlDateLocale,
  localeDisplayLabel,
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
  localeNativeTitle,
  openGraphAlternateLocaleTags,
  openGraphLocaleTag,
  paymentDisplayLocale,
  pickLocaleText,
}
export type { Locale }

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365

export function persistRingLocalePreference(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ring-locale', locale)
  document.cookie = `ring-locale=${locale}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`
}

export function nextLocaleInRoutingOrder(current: Locale): Locale {
  const order = routing.locales as readonly Locale[]
  const i = Math.max(0, order.indexOf(current))
  return order[(i + 1) % order.length] ?? DEFAULT_LOCALE
}
