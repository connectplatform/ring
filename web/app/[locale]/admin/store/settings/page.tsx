import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import StoreHubTabs from '@/components/admin/store-hub-tabs'
import { getAdminStoreSettingsAction } from '@/app/_actions/admin-store-erp'
import { StoreSettingsEditor } from '@/features/admin/store/store-settings-editor'

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
    path: 'admin.store',
    pathname: '/admin/store/settings',
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  let loaded: Awaited<ReturnType<typeof getAdminStoreSettingsAction>>
  try {
    loaded = await getAdminStoreSettingsAction()
  } catch {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="settings" />
      <Suspense>
        <StoreSettingsEditor initial={loaded.settings} novaPostKeyConfigured={loaded.novaPostKeyConfigured} />
      </Suspense>
    </AdminWrapper>
  )
}
