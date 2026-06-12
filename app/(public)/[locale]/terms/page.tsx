import type { Metadata } from 'next'
import TermsOfService from '@/features/terms/components/terms-of-service'
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'

type TermsParams = Record<string, never>

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
    path: 'terms',
    pathname: '/terms',
  })
}

export default async function TermsPage(props: LocalePageProps<TermsParams>) {
  await connection()
  await props.params
  return <TermsOfService />
}
