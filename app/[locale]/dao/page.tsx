import type { Metadata } from 'next'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { listPublicPools } from '@/features/public-pools/services/public-pool-service'
import { getRingTokenSymbol } from '@/lib/ring-config-core'
import { DaoListClient } from './dao-list-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const t = await getTranslations({ locale, namespace: 'modules.dao' })
  const token = getRingTokenSymbol()

  return {
    title: t('listingTitle'),
    description: t('listingDescription', { token }),
  }
}

export default async function DaoListingPage({
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

  const pools = await listPublicPools()
  const t = await getTranslations({ locale, namespace: 'modules.dao' })
  const token = getRingTokenSymbol()

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('listingTitle')}</h1>
        <p className="max-w-2xl text-muted-foreground">
          {t('listingDescription', { token })}
        </p>
      </header>
      <DaoListClient pools={pools} locale={locale} />
    </div>
  )
}
