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
import { getAdminStoreSettingsAction, listPromotedProductsAction } from '@/app/_actions/admin-store-erp'
import { StorePromotionsEditor } from '@/features/admin/store/store-promotions-editor'

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
    pathname: '/admin/store/promotions',
    robots: { index: false, follow: false },
  })
}

export default async function AdminStorePromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  let settings: Awaited<ReturnType<typeof getAdminStoreSettingsAction>>
  let promoted: Awaited<ReturnType<typeof listPromotedProductsAction>>
  try {
    ;[settings, promoted] = await Promise.all([
      getAdminStoreSettingsAction(),
      listPromotedProductsAction(),
    ])
  } catch {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="promotions" />
      <Suspense>
        <StorePromotionsEditor
          initial={settings.settings.promotions}
          promotedProducts={promoted}
          locale={locale}
          isPlatformAdmin={settings.isPlatformAdmin}
        />
      </Suspense>
    </AdminWrapper>
  )
}
