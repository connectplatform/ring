import 'server-only'

import { buildMessages } from '@/lib/i18n'
import type { Locale } from './shared'

/**
 * Server / RSC only — loads merged locale JSON via {@link buildMessages}.
 *
 * Prefer next-intl APIs when possible:
 * - App-wide messages: `i18n/request.ts` (`getRequestConfig`)
 * - Copy in Server Components: `getTranslations()` / `getMessages()` from `next-intl/server`
 *
 * Use this module only when you need the full messages object outside next-intl context.
 */
export async function loadTranslations(locale: Locale) {
  return buildMessages(locale, 'full')
}
