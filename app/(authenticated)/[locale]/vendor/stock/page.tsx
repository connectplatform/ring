import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { ERPStockService } from '@/features/store/services/erp-stock-service'
import { connection } from 'next/server'
import VendorStockClient from './vendor-stock-client'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.stock' })
  return { title: t('title'), description: t('description') }
}

export default async function VendorStockPage({
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

  const products = await ERPStockService.listProductsForVendor(vendorEntity.id)
  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.stock' })

  return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <VendorStockClient
          products={products}
          labels={{
            title: t('title'),
            empty: t('empty'),
            product: t('product'),
            stock: t('stock'),
            restock: t('restock'),
            restocking: t('restocking'),
            quantity: t('quantity'),
          }}
        />
      </div>
    </VendorDashboardWrapper>
  )
}
