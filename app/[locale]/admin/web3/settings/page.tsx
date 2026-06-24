import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { UserRole } from '@/features/auth/user-role'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import { Web3SettingsContent } from '@/features/admin/web3/components/web3-settings-content'

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
  return buildLocalizedMetadata({
    locale,
    path: 'admin',
    pathname: '/admin/web3/settings',
    robots: { index: false, follow: false },
  })
}

export default async function Web3SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  const tAdmin = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(tAdmin)
  const session = await auth()

  if (!session?.user) redirect(ROUTES.LOGIN(validLocale))
  if (session.user.role !== UserRole.superadmin) redirect(ROUTES.UNAUTHORIZED(validLocale))

  return (
    <AdminWrapper locale={validLocale} labels={adminLabels}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Web3 / Ring Desk</h1>
        <Web3SettingsContent />
      </div>
    </AdminWrapper>
  )
}
