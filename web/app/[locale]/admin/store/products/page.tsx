import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Suspense } from 'react'
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
import { listAdminStoreProducts } from '@/app/_actions/admin-store-erp'
import { ADMIN_LIST_PAGE_SIZE } from '@/lib/admin/admin-list-dto'
import AdminProductsClient from './admin-products-client'

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
    path: 'admin.store.products',
    pathname: '/admin/store/products',
    fallback: {
      title: t('title'),
      description: t('subtitle'),
    },
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ approval?: string }>
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

  const resolvedSearch = await searchParams
  const approvalFilter =
    resolvedSearch.approval === 'pending' ||
    resolvedSearch.approval === 'approved' ||
    resolvedSearch.approval === 'rejected'
      ? resolvedSearch.approval
      : 'all'

  const productPage = await listAdminStoreProducts({
    limit: ADMIN_LIST_PAGE_SIZE,
    offset: 0,
    approvalStatus: approvalFilter,
  })

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="products" />
      <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
        <AdminProductsClient
          products={productPage.items}
          initialHasMore={productPage.hasMore}
          initialNextOffset={productPage.nextOffset}
          initialApprovalFilter={approvalFilter}
          locale={locale}
        />
      </Suspense>
    </AdminWrapper>
  )
}
