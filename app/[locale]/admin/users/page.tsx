import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { AuthUser } from '@/features/auth/types'
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

async function getUsers(): Promise<AuthUser[]> {
  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 },
    })

    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to fetch users')
    }

    return result.data.map((row) => {
      const data = row as Record<string, unknown>
      return {
        id: String(data.id ?? ''),
        email: String(data.email ?? ''),
        name: (data.name as string | null) ?? null,
        role: (data.role as AuthUser['role']) ?? 'subscriber',
        isVerified: Boolean(data.isVerified ?? data.is_verified ?? false),
        createdAt: data.createdAt ? new Date(String(data.createdAt)) : new Date(),
        lastLogin: data.lastLogin ? new Date(String(data.lastLogin)) : new Date(),
        photoURL:
          (data.photoURL as string | null) ??
          (data.image as string | null) ??
          (data.avatar as string | null) ??
          null,
        emailVerified: data.emailVerified ? new Date(String(data.emailVerified)) : null,
        authProvider: String(data.authProvider ?? 'credentials'),
        authProviderId: String(data.authProviderId ?? data.id ?? ''),
        globalUserId: String(data.global_user_id ?? data.id ?? ''),
        accountStatus: (data.account_status as AuthUser['accountStatus']) ?? 'ACTIVE',
        wallets: Array.isArray(data.wallets) ? data.wallets : [],
      } as AuthUser
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

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

  const users = await getUsers()
  const analytics = await getPlatformAnalytics('7d')
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={validLocale} pageContext="users" labels={adminLabels}>
      <AdminUsersDashboardClient
        initialUsers={users}
        locale={validLocale}
        labels={adminLabels}
        analytics={analytics}
      />
    </AdminWrapper>
  )
}
