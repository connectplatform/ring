import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { StoreOrdersService } from '@/features/store/services/orders-service'
import { connection } from 'next/server'
import VendorOrdersClient from './vendor-orders-client'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.orders' })
  return { title: t('title'), description: t('description') }
}

export default async function VendorOrdersPage({
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

  const { items: orders } = await StoreOrdersService.listOrdersForVendor(vendorEntity.id)
  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.orders' })

  const rows = orders.map((order: any) => {
    const vendorSettlement = Array.isArray(order.vendorSettlements)
      ? order.vendorSettlements.find(
          (s: any) => s.vendorId === vendorEntity.id || s.vendorEntityId === vendorEntity.id,
        )
      : undefined
    return {
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      vendorSettlement,
    }
  })

  return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <VendorOrdersClient
          orders={rows}
          labels={{
            title: t('title'),
            empty: t('empty'),
            order: t('orderId'),
            status: t('status'),
            total: t('total'),
            net: t('netAmount'),
            date: t('date'),
          }}
        />
      </div>
    </VendorDashboardWrapper>
  )
}
