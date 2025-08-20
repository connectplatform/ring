import { defineRouting } from 'next-intl/routing'
import { buildMessages } from '@/lib/i18n'

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'uk'],
  
  // Used when no locale matches
  defaultLocale: 'en',
  
  // The `pathnames` object holds pairs of internal and
  // external paths. Based on the locale, the external
  // paths are rewritten to the shared, internal ones.
  pathnames: {
    // If all locales use the same pathname, a single
    // external path can be provided for all locales
    '/': '/',
    '/about': '/about',
    '/contact': '/contact',
    '/privacy': '/privacy',
    '/terms': '/terms',
    '/store': '/store',
    '/store/[id]': '/store/[id]',
    '/store/cart': '/store/cart',
    '/store/checkout': '/store/checkout'
  }
})

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export type Pathnames = keyof typeof routing.pathnames
export type Locale = (typeof routing.locales)[number]

// Re-export commonly used i18n values for convenience and migration compatibility
export const locales = routing.locales
export const defaultLocale = routing.defaultLocale as Locale

// Helpers for migration compatibility with previous i18n-server utilities
export function isValidLocale(input: string): input is Locale {
  return (routing.locales as readonly string[]).includes(input)
}

// Load messages JSON for a locale; optionally filter by namespaces (not enforced here)
export async function loadTranslations(locale: Locale) {
  // Use strict split-namespace loader; no legacy flat JSON files
  return buildMessages(locale)
}

// Generate simple hreflang alternates for a given pathname
export function generateHreflangAlternates(pathname: string): Record<string, string> {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const map: Record<string, string> = {}
  for (const loc of routing.locales) {
    map[loc] = `/${loc}${normalized}`
  }
  return map
}
