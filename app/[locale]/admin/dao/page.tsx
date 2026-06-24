import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { listPublicPools } from '@/features/public-pools/services/public-pool-service'
import AdminDaoClient from './admin-dao-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection()
  return { title: 'Public pools | Admin' }
}

export default async function AdminDaoPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO(locale))}`,
    )
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const pools = await listPublicPools({ limit: 200 })
  const labels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <AdminDaoClient pools={pools} locale={locale} />
    </AdminWrapper>
  )
}
