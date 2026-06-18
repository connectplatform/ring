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
import { PlatformSettingsContent } from '@/features/admin/platform-settings/components/platform-settings-content'
import {
  loadPlatformSettingsForAdmin,
  testPlatformAIConnection,
  updatePlatformAISettings,
  updatePlatformBrandingSettings,
} from '@/app/_actions/platform-settings'

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
    pathname: '/admin/settings',
    robots: { index: false, follow: false },
  })
}

export default async function PlatformSettingsPage({
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

  const { ai, branding } = await loadPlatformSettingsForAdmin()

  return (
    <AdminWrapper locale={validLocale} pageContext="settings" labels={adminLabels}>
      <PlatformSettingsContent
        ai={ai}
        branding={branding}
        updateAIAction={updatePlatformAISettings}
        updateBrandingAction={updatePlatformBrandingSettings}
        testConnectionAction={testPlatformAIConnection}
      />
    </AdminWrapper>
  )
}
