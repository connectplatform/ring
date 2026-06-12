import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { db } from '@/lib/database'
import VendorStorefront from './vendor-storefront'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { isValidLocale, defaultLocale } from '@/i18n/shared'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; vendorId: string }> }) {
  const { locale, vendorId } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.storefront' })

  const entityResult = await db().readDoc('entities', vendorId)
  
  if (!entityResult.success || !entityResult.data) {
    return {
      title: 'Vendor Not Found',
    }
  }

  const entity = entityResult.data as Record<string, unknown>
  const entityName = String(entity.name ?? '')

  return {
    title: t('metadataTitle', { name: entityName }),
    description: String(entity.description ?? '') || t('metadataDescription', { name: entityName }),
  }
}

export default async function VendorStorefrontPage({
  params,
}: {
  params: Promise<{ locale: string; vendorId: string }>
}) {
  const { locale, vendorId } = await params
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  
  // Fetch vendor entity
  const entityResult = await db().readDoc('entities', vendorId)
  
  if (!entityResult.success || !entityResult.data) {
    notFound()
  }

  const vendorEntity = entityResult.data as Record<string, unknown>

  // Verify it's a vendor entity
  if (vendorEntity.category !== 'vendor' || !vendorEntity.storeActivated) {
    notFound()
  }

  const productsResult = await db().queryDocs({
    collection: 'store_products',
    filters: [
      { field: 'entity_id', operator: '=', value: vendorId },
      { field: 'status', operator: '=', value: 'active' },
    ],
  })

  const products = productsResult.success && productsResult.data ? productsResult.data : []

  return (
    <StoreWrapper locale={validLocale}>
      <VendorStorefront 
        locale={validLocale}
        vendorEntity={vendorEntity}
        products={products}
      />
    </StoreWrapper>
  )
}

