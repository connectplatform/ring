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
import { listAllSettlements, listProductReferralRates } from '@/app/_actions/admin-store-erp'
import AdminCommissionsClient from './admin-commissions-client'

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
    path: 'admin.store.commissions',
    pathname: '/admin/store/commissions',
    robots: { index: false, follow: false },
  })
}

export default async function AdminStoreCommissionsPage({
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
  const [settlements, productReferralRates] = await Promise.all([
    listAllSettlements(100),
    listProductReferralRates(50),
  ])

  const tabLabels = {
    orders: t('storeHub.orders'),
    stock: t('storeHub.stock'),
    commissions: t('storeHub.commissions'),
  }

  const commissionLabels = {
    title: t('storeHub.commissionsTitle'),
    processPayouts: t('storeHub.processPayouts'),
    processing: t('storeHub.processingPayouts'),
    pending: t('storeHub.pendingSettlements'),
    vendor: t('storeHub.vendor'),
    amount: t('storeHub.netPayout'),
    commission: t('storeHub.commission'),
    status: t('storeHub.status'),
    scheduled: t('storeHub.scheduledFor'),
    noSettlements: t('storeHub.noSettlements'),
    settlementsTable: t('storeHub.settlementsTable'),
    confirmProcessPayouts: t('storeHub.confirmProcessPayouts'),
    noSettlementsDueMessage: t('storeHub.noSettlementsDueMessage'),
    batchComplete: t('storeHub.batchComplete'),
    processSettlementsError: t('storeHub.processSettlementsError'),
    inclReferral: t('storeHub.inclReferral'),
    referralRatesTitle: t('storeHub.referralRatesTitle'),
    referralRatesProduct: t('storeHub.referralRatesProduct'),
    referralRatesVendor: t('storeHub.referralRatesVendor'),
    referralRatesPercent: t('storeHub.referralRatesPercent'),
    referralRatesSource: t('storeHub.referralRatesSource'),
    referralRatesEmpty: t('storeHub.referralRatesEmpty'),
    referralSourceProduct: t('storeHub.referralSource.product'),
    referralSourceMerchant: t('storeHub.referralSource.merchant'),
    referralSourceDefault: t('storeHub.referralSource.default'),
    referralSourceEnv: t('storeHub.referralSource.env'),
    effectiveReferralRate: t('storeHub.effectiveReferralRate'),
    simulatedBadge: t('storeHub.simulatedBadge'),
  }

  return (
    <AdminWrapper locale={locale} pageContext="store" labels={adminLabels}>
      <StoreHubTabs locale={locale} active="commissions" labels={tabLabels} />
      <Suspense fallback={<div className="h-64 animate-pulse bg-muted rounded-lg" />}>
        <AdminCommissionsClient
          settlements={settlements}
          productReferralRates={productReferralRates}
          labels={commissionLabels}
        />
      </Suspense>
    </AdminWrapper>
  )
}
