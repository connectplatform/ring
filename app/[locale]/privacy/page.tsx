import type { Metadata } from 'next'
import PrivacyPolicy from '@/features/privacy/components/privacy-policy'
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'

type PrivacyParams = Record<string, never>

// Generates SEO metadata for the privacy page, using locale info from URL params.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Await and extract the locale from route params
  const { locale: localeParam } = await params

  // Determine final locale: use passed locale if it's recognized, otherwise default
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the locale for this request for intl-aware components
  setRequestLocale(locale)

  // Return SEO metadata specifically for this page
  return buildLocalizedMetadata({
    locale,
    path: 'privacy',
    pathname: '/privacy',
  })
  // TODO: Next.js 16 allows for route segment config: see if static metadata can be declared in the config export for more optimization.
}

// Main privacy page component (async since it awaits server-side operations)
export default async function PrivacyPage(props: LocalePageProps<PrivacyParams>) {
  // Establish any server-side connection needed for this page (e.g., DB or service connection)
  await connection()

  // Wait for params, though params aren't used directly (likely for side-effects in some middleware)
  await props.params
  // TODO: Consider using React 19 use() for async data (if this is run on client), or refactoring param usage.

  return <PrivacyPolicy />
}
