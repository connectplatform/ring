import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Locale } from '@/i18n/shared'
import { routing } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { connection } from 'next/server'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { AdminUsersDashboardClient } from '@/components/admin/admin-users-dashboard-client'
import { getPlatformAnalytics } from '@/features/analytics/services/get-platform-analytics'
import { listAdminUsersPage } from '@/app/_actions/admin-users'
import { ADMIN_LIST_PAGE_SIZE } from '@/lib/admin/admin-list-dto'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection()
  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const t = await getTranslations({ locale: validLocale, namespace: 'modules.admin' })

  return {
    title: `${t('usersDashboard')} | Admin`,
    description: t('usersDashboardDescription'),
  }
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await connection()
  await searchParams

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  setRequestLocale(validLocale)
  const t = await getTranslations('modules.admin')

  const session = await auth()

  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_USERS(validLocale))}`,
    )
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const usersPage = await listAdminUsersPage({ limit: ADMIN_LIST_PAGE_SIZE, offset: 0 })
  const analytics = await getPlatformAnalytics('7d')
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={validLocale} pageContext="users" labels={adminLabels}>
      <AdminUsersDashboardClient
        initialUsers={usersPage.items}
        initialHasMore={usersPage.hasMore}
        initialNextOffset={usersPage.nextOffset}
        totalUserCount={usersPage.totalCount}
        locale={validLocale}
        labels={adminLabels}
        analytics={analytics}
      />
    </AdminWrapper>
  )
}
