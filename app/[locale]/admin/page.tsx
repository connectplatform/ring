import type { Metadata } from 'next'
import { getRingSeoBranding } from '@/lib/ring-config-core'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { routing } from '@/i18n/routing'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { isFeatureEnabledOnServer } from '@/whitelabel/features'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import { defaultLocale } from '@/i18n/shared'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { getPlatformAnalytics } from '@/features/analytics/services/get-platform-analytics'
import { getSecurityOverview } from '@/features/admin/security/services/get-security-overview'
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client'

const adminRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
}

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
  const t = await getTranslations('modules.admin')
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin',
    fallback: {
      title: `${t('title')} | ${getRingSeoBranding().siteName}`,
      description: t('userManagementDescription'),
    },
    robots: adminRobots,
  })
}

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  if (!isFeatureEnabledOnServer('admin')) {
    return null
  }

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (defaultLocale as Locale)

  setRequestLocale(validLocale)
  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  const [analytics, security] = await Promise.all([
    getPlatformAnalytics('7d'),
    getSecurityOverview(),
  ])

  return (
    <AdminWrapper locale={validLocale} pageContext="dashboard" labels={adminLabels}>
      <AdminDashboardClient
        analytics={analytics}
        security={security}
        labels={adminLabels}
        locale={validLocale}
      />
    </AdminWrapper>
  )
}
