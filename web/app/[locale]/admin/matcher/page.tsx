import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { getRingSeoBranding } from '@/lib/ring-config-core'
import { getMatcherAnalytics } from '@/features/admin/matcher/services/get-matcher-analytics'
import { parseMatcherTimeframe } from '@/features/admin/matcher/types/matcher-analytics'
import AdminMatcherClient from './admin-matcher-client'

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
  const branding = getRingSeoBranding()
  const t = await getTranslations('modules.admin.matcher')

  return buildLocalizedMetadata({
    locale,
    path: 'admin.matcher',
    pathname: '/admin/matcher',
    fallback: {
      title: `${t('title')} | Admin`,
      description: t('subtitle'),
    },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  })
}

export default async function AdminMatcherPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ timeframe?: string }>
}) {
  await connection()

  const { locale } = await params
  const { timeframe: timeframeParam } = await searchParams

  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      ROUTES.LOGIN(validLocale) +
        `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_MATCHER(validLocale))}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  setRequestLocale(validLocale)

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  const timeframe = parseMatcherTimeframe(timeframeParam)
  const analytics = await getMatcherAnalytics(timeframe)
  const settingsPath = ROUTES.ADMIN_SETTINGS(validLocale)

  return (
    <AdminWrapper locale={validLocale} pageContext="matcher" labels={adminLabels}>
      <AdminMatcherClient data={analytics} locale={validLocale} settingsPath={settingsPath} />
    </AdminWrapper>
  )
}
