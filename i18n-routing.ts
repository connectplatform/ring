import { defineRouting } from 'next-intl/routing'

/**
 * Minimal i18n Routing Configuration for Edge Runtime
 * 
 * This file contains ONLY the routing configuration needed for middleware.
 * Extracted from i18n-config.ts to reduce edge runtime bundle size.
 * 
 * WHY THIS EXISTS:
 * - i18n-config.ts imports @/lib/i18n (buildMessages function)
 * - buildMessages pulls in translation loading logic (unnecessary for routing)
 * - Middleware only needs locale routing, not translation loading
 * 
 * USAGE:
 * - Middleware: import { routing } from './i18n-routing'
 * - App code: import { routing, loadTranslations, etc } from './i18n-config'
 * 
 * Per Next.js 15 Specialist guidance:
 * - Separate edge runtime imports from server runtime imports
 * - Keep middleware bundle minimal (<100KB target)
 * - Extract only what's needed for routing decisions
 */

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'uk', 'ru'],
  
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

// Locale type for edge runtime
export type Locale = (typeof routing.locales)[number]

