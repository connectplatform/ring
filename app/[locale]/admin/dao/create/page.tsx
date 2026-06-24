import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { AdminPoolForm } from '@/features/public-pools/components/admin-pool-form'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  await connection()
  const t = await getTranslations('modules.dao.admin.create')
  return { title: `${t('title')} | Admin` }
}

export default async function AdminDaoCreatePage({
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
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_DAO_CREATE(locale))}`,
    )
  }
  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const tDao = await getTranslations('modules.dao.admin.create')
  const labels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="dao" labels={labels}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{tDao('title')}</h1>
        <p className="mt-2 text-muted-foreground">{tDao('description')}</p>
      </div>
      <AdminPoolForm mode="create" locale={locale} />
    </AdminWrapper>
  )
}
