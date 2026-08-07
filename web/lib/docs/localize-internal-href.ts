import { defaultLocale } from '@/i18n/shared'

/** Prefix internal absolute paths with locale when prefix is required (`as-needed`). */
export function localizeInternalHref(href: string, locale: string): string {
  if (!href || typeof href !== 'string') return href
  if (!href.startsWith('/') || href.startsWith('//')) return href
  if (locale === defaultLocale) return href
  if (href === `/${locale}` || href.startsWith(`/${locale}/`)) return href
  // Skip already-prefixed other locales
  if (/^\/(en|uk|ru|de|es)(\/|$)/.test(href)) return href
  return `/${locale}${href}`
}
