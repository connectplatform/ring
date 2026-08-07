import 'server-only'

import type { NextRequest } from 'next/server'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  isValidLocale,
  resolveLocale,
  type Locale,
} from '@/lib/locale-config'
import { resolveLocaleFromPathname } from '@/lib/proxy-intl'
import { db } from '@/lib/database'

function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null

  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase()
    if (!tag) continue

    if (isValidLocale(tag)) return tag

    const short = tag.split('-')[0]
    if (short && isValidLocale(short)) return short

    if (tag.startsWith('uk') || tag === 'ua') return 'uk'
  }

  return null
}

export async function getUserPreferredLocale(userId: string): Promise<Locale | null> {
  try {
    const result = await db().findDocById<{ settings?: { language?: string } }>('users', userId)
    if (!result.success || !result.data) return null

    const language = result.data.settings?.language
    return language && isValidLocale(language) ? language : null
  } catch {
    return null
  }
}

/**
 * Resolve locale for server-side copy (emails, agent greetings, etc.).
 * Priority: user profile language → device (ring-locale cookie, Accept-Language) → URL pathname → project default.
 */
export async function resolveServerLocale(
  request?: NextRequest,
  options?: { userId?: string },
): Promise<Locale> {
  if (options?.userId) {
    const userLocale = await getUserPreferredLocale(options.userId)
    if (userLocale) return userLocale
  }

  const cookieStore = await cookies()
  const ringLocale = cookieStore.get('ring-locale')?.value
  if (ringLocale && isValidLocale(ringLocale)) return ringLocale

  const headerList = await headers()
  const acceptLanguage =
    request?.headers.get('accept-language') ?? headerList.get('accept-language')
  const fromAccept = localeFromAcceptLanguage(acceptLanguage)
  if (fromAccept) return fromAccept

  const pathname =
    request?.headers.get('x-pathname') ??
    headerList.get('x-pathname') ??
    request?.nextUrl.pathname

  if (pathname) {
    return resolveLocale(resolveLocaleFromPathname(pathname))
  }

  return DEFAULT_LOCALE
}
