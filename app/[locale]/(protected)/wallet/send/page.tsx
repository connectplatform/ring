import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import SendTokens from '@/features/wallet/components/send-tokens'

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
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'wallet.send',
    pathname: '/wallet/send',
    robots,
  })
}

export default async function WalletSendPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <WalletWrapper locale={locale}>
      <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg m-6" />}>
        <WalletSendContent params={params} />
      </Suspense>
    </WalletWrapper>
  )
}

async function WalletSendContent({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const session = await auth()
  if (!session) return null

  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  return (
    <div className="p-4 sm:p-6">
      <SendTokens locale={locale} embedded />
    </div>
  )
}
