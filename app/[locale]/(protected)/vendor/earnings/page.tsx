import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import {
  getVendorPayoutHistory,
  getVendorPendingPayouts,
} from '@/features/store/services/settlement'
import { connection } from 'next/server'
import VendorEarningsClient from './vendor-earnings-client'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.earnings' })
  return { title: t('title'), description: t('description') }
}

export default async function VendorEarningsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user?.id) redirect(ROUTES.LOGIN(validLocale))

  const vendorEntity = await getVendorEntity(session.user.id)
  if (!vendorEntity) redirect(ROUTES.VENDOR_START(validLocale))

  const vendorId = vendorEntity.id
  const [history, pending] = await Promise.all([
    getVendorPayoutHistory(vendorId),
    getVendorPendingPayouts(vendorId),
  ])

  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.earnings' })

  return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <VendorEarningsClient
          pendingTotal={pending.total}
          pendingSettlements={pending.settlements}
          history={history}
          labels={{
            title: t('title'),
            pending: t('pending'),
            history: t('history'),
            amount: t('amount'),
            commission: t('commission'),
            status: t('status'),
            scheduled: t('scheduled'),
            empty: t('empty'),
            simulatedBadge: t('simulatedBadge'),
          }}
        />
      </div>
    </VendorDashboardWrapper>
  )
}
