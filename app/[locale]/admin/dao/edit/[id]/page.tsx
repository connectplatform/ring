import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { AdminPoolForm } from '@/features/public-pools/components/admin-pool-form'
import { getPublicPoolById } from '@/features/public-pools/services/public-pool-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  await connection()
  const { id } = await params
  const pool = await getPublicPoolById(id)
  const t = await getTranslations('modules.dao.admin.edit')
  return { title: pool ? `${t('title')}: ${pool.title}` : `${t('title')} | Admin` }
}

export default async function AdminDaoEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO_EDIT(id, locale))}`,
    )
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const pool = await getPublicPoolById(id)
  if (!pool) {
    notFound()
  }

  const t = await getTranslations('modules.admin')
  const tDao = await getTranslations('modules.dao.admin.edit')
  const labels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{tDao('title')}</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{pool.pool_slug}</p>
      </div>
      <AdminPoolForm mode="edit" locale={locale} pool={pool} />
    </AdminWrapper>
  )
}
