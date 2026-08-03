import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'

/**
 * /register retired — password signup demoted; OTP/magic/login is the product surface.
 * Permanent redirect to /login (preserve locale + from/callback query).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'auth.login',
    pathname: '/login',
    robots: { index: false, follow: false },
  })
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const key of ['from', 'callbackUrl', 'returnTo', 'error'] as const) {
    const v = sp[key]
    const s = typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined
    if (s) q.set(key === 'returnTo' || key === 'callbackUrl' ? 'from' : key, s)
  }
  const qs = q.toString()
  redirect(`/${locale}/login${qs ? `?${qs}` : ''}`)
}
