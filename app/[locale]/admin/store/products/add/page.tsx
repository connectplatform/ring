import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import AdminWrapper from '@/components/wrappers/admin-wrapper'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import { connection } from 'next/server'
import StoreHubTabs from '@/components/admin/store-hub-tabs'
import { listActiveVendorsForAdmin } from '@/app/_actions/admin-store-erp'
import ProductForm from '@/app/[locale]/(protected)/vendor/products/product-form'

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
  const t = await getTranslations('modules.admin.storeHub.productsPage')
  return buildLocalizedMetadata({
    locale,
    path: 'admin.store.products.add',
    pathname: '/admin/store/products/add',
    fallback: {
      title: t('addTitle'),
      description: t('addSubtitle'),
    },
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreProductAddPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale

  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  if (!isPlatformAdmin(session.user.role)) redirect(ROUTES.UNAUTHORIZED(locale))

  const t = await getTranslations('modules.admin')
  const adminLabels = buildModulesAdminLabels(t)
  const vendors = await listActiveVendorsForAdmin()

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="products" />
      <div className="max-w-3xl">
        <ProductForm
          mode="create"
          variant="admin"
          locale={locale}
          vendorEntity={{}}
          adminVendors={vendors}
        />
      </div>
    </AdminWrapper>
  )
}
