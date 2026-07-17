import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { CalculatorEngine } from '@/features/calculator/calculator-engine'
import { resolveCalculatorRates } from '@/features/calculator/rates'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'

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
    path: 'calculator',
    pathname: '/calculator',
  })
}

export default async function CalculatorPage({
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

  const config = getSystemConfigSnapshot()
  // SSOT: top-level ring-config.calculator.enabled (portal feature-shell contract)
  if (!config.calculator?.enabled) {
    notFound()
  }

  const rates = resolveCalculatorRates()

  return (
    <RingRightRailLayout
      showRightRail={false}
      flushCenterPane
      contentClassName="pb-24 lg:pb-8"
    >
      <DavinciCenterPane>
        <CalculatorEngine rates={rates} />
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
