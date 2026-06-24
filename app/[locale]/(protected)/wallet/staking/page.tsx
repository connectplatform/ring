import type { Metadata } from 'next'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import WalletWrapper from '@/components/wrappers/wallet-wrapper'
import WalletStakingClient from './staking-client'

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
    path: 'wallet.staking',
    pathname: '/wallet/staking',
    robots,
  })
}

export default async function WalletStakingPage({
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
      <Suspense
        fallback={<div className="animate-pulse h-64 bg-muted rounded-lg m-6" />}
      >
        <WalletStakingContent locale={locale} />
      </Suspense>
    </WalletWrapper>
  )
}

async function WalletStakingContent({ locale }: { locale: Locale }) {
  await connection()
  const session = await auth()
  if (!session) return null
  return <WalletStakingClient locale={locale} />
}
