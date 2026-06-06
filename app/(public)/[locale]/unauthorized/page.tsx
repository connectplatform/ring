import type { Metadata } from 'next'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'
import { LocalePageProps } from '@/utils/page-props'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { connection } from 'next/server'

type UnauthorizedParams = { locale: Locale }

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
  const t = await getTranslations('common')
  return buildLocalizedMetadata({
    locale,
    path: 'unauthorized',
    pathname: '/unauthorized',
    fallback: {
      title: t('metadata.unauthorized'),
      description: t('metaDescription.unauthorized'),
    },
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}

export default async function Unauthorized(props: LocalePageProps<UnauthorizedParams>) {
  await connection()
  const params = await props.params
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale

  const t = await getTranslations('common')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">{t('unauthorized.title')}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">{t('unauthorized.message')}</p>
      <Link href={ROUTES.HOME(locale)} className="text-primary hover:underline">
        {t('unauthorized.returnHome')}
      </Link>
    </div>
  )
}
