import type { Metadata } from 'next'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'

type UnauthorizedParams = { locale: Locale }

// Generates metadata for the unauthorized page, including title, description, and robots tags.
// Extracts the locale from params, falls back to the default locale if necessary.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Wait for params to resolve and destructure locale parameter
  const { locale: localeParam } = await params
  // Validate locale against allowed locales, fallback to default if invalid
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  // Set the request's locale context for this page
  setRequestLocale(locale)
  // Fetch common translations for displayed strings and metadata
  const t = await getTranslations('common')

  // Build and return localized SEO metadata for unauthorized page
  return buildLocalizedMetadata({
    locale,
    path: 'unauthorized',
    pathname: '/unauthorized',
    fallback: {
      title: t('metadata.unauthorized'),
      description: t('metaDescription.unauthorized'),
    },
    robots: { index: false, follow: false }, // prevent indexing
  })
}

export default async function Unauthorized(props: LocalePageProps<UnauthorizedParams>) {
  // Ensure server connection is established (e.g., for database or session)
  await connection()

  // TODO: If Next.js 16/new React allows better usage for Server Components or hooks, refactor accordingly.

  // Extract params, which might be a promise—await it if necessary
  const params = await props.params

  // Validate and select locale, fallback if needed
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  // Fetch 'common' translation namespace
  const t = await getTranslations('common')

  // Render the unauthorized message UI, using translations for localized text
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Heading for unauthorized page */}
      <h1 className="text-3xl font-bold mb-4">{t('unauthorized.title')}</h1>
      {/* Description/explanation */}
      <p className="text-muted-foreground mb-8 max-w-md">{t('unauthorized.message')}</p>
      {/* Link to return to localized home */}
      <Link href={ROUTES.HOME(locale)} className="text-primary hover:underline">
        {t('unauthorized.returnHome')}
      </Link>
    </div>
  )
}
