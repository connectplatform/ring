import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { db } from '@/lib/database'
import VendorStorefront from './vendor-storefront'
import StoreWrapper from '@/components/wrappers/store-wrapper'
import { isValidLocale, defaultLocale } from '@/i18n/shared'

// Generates metadata for the vendor storefront page
export async function generateMetadata({ params }: { params: Promise<{ locale: string; vendorId: string }> }) {
  // This "params" is a promise, so we must await it
  const { locale, vendorId } = await params
  // Validate locale, fall back if invalid
  const validLocale = isValidLocale(locale) ? locale : defaultLocale
  // Get translations for the required namespace and locale
  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.storefront' })

  // Read the vendor entity document from the database
  const entityResult = await db().readDoc('entities', vendorId)
  
  // If entity fetch fails or no data is found, return a fallback title
  if (!entityResult.success || !entityResult.data) {
    return {
      title: 'Vendor Not Found',
    }
  }

  // Extract the entity and ensure the name is a string
  const entity = entityResult.data as Record<string, unknown>
  const entityName = String(entity.name ?? '')

  // Compose the title and description using translations and entity data
  return {
    title: t('metadataTitle', { name: entityName }),
    description: String(entity.description ?? '') || t('metadataDescription', { name: entityName }),
  }
  // TODO: Use Next.js 16 route segment config for metadata if possible for better type safety.
}

export default async function VendorStorefrontPage({
  params,
}: {
  params: Promise<{ locale: string; vendorId: string }>
}) {
  // Destructure "locale" and "vendorId" from awaited params
  const { locale, vendorId } = await params
  // Validate locale, fall back to default if invalid
  const validLocale = isValidLocale(locale) ? locale : defaultLocale

  // Fetch vendor entity from the database
  const entityResult = await db().readDoc('entities', vendorId)
  
  // If the entity query fails or is not found, trigger a 404
  if (!entityResult.success || !entityResult.data) {
    notFound()
  }

  // Extract the vendor entity data
  const vendorEntity = entityResult.data as Record<string, unknown>

  // Verify this is actually a vendor and that its store is activated
  if (vendorEntity.category !== 'vendor' || !vendorEntity.storeActivated) {
    notFound()
  }

  // Query active store products associated with this vendor
  const productsResult = await db().queryDocs({
    collection: 'store_products',
    filters: [
      { field: 'entity_id', operator: '=', value: vendorId },
      { field: 'status', operator: '=', value: 'active' },
    ],
  })

  // Use the products from the query result or fall back to an empty array
  const products = productsResult.success && productsResult.data ? productsResult.data : []

  // Render the store wrapper + storefront, passing down the relevant props
  return (
    <StoreWrapper locale={validLocale}>
      <VendorStorefront 
        locale={validLocale}
        vendorEntity={vendorEntity}
        products={products}
      />
    </StoreWrapper>
  )
  // TODO: Switch to the new Next.js 16 "searchParams" and route handler conventions when upgrading
  // TODO: Consider using React cache() for stable data fetching if data is immutable during request duration
}
