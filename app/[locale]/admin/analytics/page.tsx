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
import { getRingSeoBranding } from '@/lib/ring-config'
import { getPlatformAnalytics } from '@/features/analytics/services/get-platform-analytics'
import AdminAnalyticsClient from './admin-analytics-client'

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
  const t = await getTranslations('modules.admin.webAnalytics')
  return buildLocalizedMetadata({
    locale,
    path: 'admin.analytics',
    pathname: '/admin/analytics',
    fallback: {
      title: `${t('title', { projectName: branding.siteName })} | Admin`,
      description: t('subtitle'),
    },
    robots: { index: false, follow: false, noarchive: true, nosnippet: true, noimageindex: true },
  })
}

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      ROUTES.LOGIN(validLocale) +
        `?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_ANALYTICS(validLocale))}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  setRequestLocale(validLocale)
  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)
  const projectName = getRingSeoBranding().siteName
  const analytics = await getPlatformAnalytics('7d')

  return (
    <AdminWrapper locale={validLocale} pageContext="analytics" labels={adminLabels}>
      <AdminAnalyticsClient
        projectName={projectName}
        data={analytics}
        labels={adminLabels}
      />
    </AdminWrapper>
  )
}
