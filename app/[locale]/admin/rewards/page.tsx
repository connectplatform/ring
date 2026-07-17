import type { Metadata } from 'next'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { ROUTES } from '@/constants/routes'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { AdminRewardsDashboard } from '@/features/admin/components/admin-rewards-dashboard'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale
  const t = await getTranslations({ locale: validLocale, namespace: 'modules.admin.rewardMonitoring' })

  return {
    title: `${t('title')} | Admin`,
    description: t('subtitle'),
    robots: { index: false, follow: false },
  }
}

export default async function AdminRewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale
  setRequestLocale(validLocale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_REWARDS(validLocale))}`,
    )
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const t = await getTranslations('modules.admin')
  return (
    <AdminWrapper locale={validLocale} pageContext="rewards" labels={buildModulesAdminLabels(t)}>
      <AdminRewardsDashboard locale={validLocale} />
    </AdminWrapper>
  )
}
