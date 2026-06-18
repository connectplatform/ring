import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { getRingConfig } from '@/lib/ring-config'
import { CalculatorEngine } from '@/features/calculator/calculator-engine'

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

  const config = getRingConfig()
  if (!config.calculator?.enabled) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <CalculatorEngine />
    </div>
  )
}
