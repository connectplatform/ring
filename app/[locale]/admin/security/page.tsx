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
import { getSecurityOverview } from '@/features/admin/security/services/get-security-overview'
import AdminSecurityCenterClient from './admin-security-center-client'

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
    path: 'admin.security',
    pathname: '/admin/security',
    fallback: {
      title: `${t('securityCenter')} | Admin`,
      description: t('description'),
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

export default async function SecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  await searchParams
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_SECURITY(locale))}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const [t, overview] = await Promise.all([
    getTranslations('modules.admin'),
    getSecurityOverview(),
  ])
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="security" labels={adminLabels}>
      <AdminSecurityCenterClient data={overview} locale={locale} />
    </AdminWrapper>
  )
}
