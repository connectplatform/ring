// Import translations statically to avoid Node.js APIs in Edge Runtime
import enTranslations from '../locales/en.json'
import ukTranslations from '../locales/uk.json'

// Supported locales
export const locales = ['en', 'uk'] as const
export type Locale = typeof locales[number]

// Default locale
export const defaultLocale: Locale = 'en'

// Static translations map
const translations = {
  en: enTranslations,
  uk: ukTranslations
} as const

// Load translations for a specific locale
export function loadTranslations(locale: Locale) {
  try {
    return translations[locale] || translations[defaultLocale]
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error)
    // Fallback to English if translation loading fails
    return translations[defaultLocale]
  }
}

// Validate locale
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}

// Get locale from pathname
export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split('/')
  const potentialLocale = segments[1]
  
  if (potentialLocale && isValidLocale(potentialLocale)) {
    return potentialLocale
  }
  
  return defaultLocale
}

// Generate hreflang alternates for metadata
export function generateHreflangAlternates(pathname: string, baseUrl?: string) {
  // Use environment variable or fallback to localhost
  const url = baseUrl || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) || 'http://localhost:3000'
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
  
  const alternates: Record<string, string> = {}
  
  locales.forEach(locale => {
    alternates[locale] = `${url}/${locale}${pathWithoutLocale}`
  })
  
  // Add x-default pointing to default locale
  alternates['x-default'] = `${url}/${defaultLocale}${pathWithoutLocale}`
  
  return alternates
} 