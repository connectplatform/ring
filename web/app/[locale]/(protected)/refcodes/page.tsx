import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import RefcodesClient from './refcodes-client'

const robots: Metadata['robots'] = { index: false, follow: false }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  return buildLocalizedMetadata({
    locale,
    path: 'refcodes',
    pathname: '/refcodes',
    robots,
  })
}

export default async function RefcodesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 min-h-[100dvh] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <RefcodesClient locale={locale} />
      </Suspense>
    </div>
  )
}
