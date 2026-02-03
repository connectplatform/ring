import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import VendorStorefront from './vendor-storefront'
import StoreWrapper from '@/components/wrappers/store-wrapper'

export async function generateMetadata({ params }: { params: { locale: string; vendorId: string } }) {
  await initializeDatabase()
  const db = getDatabaseService()
  
  const entityResult = await db.read('entities', params.vendorId)
  
  if (!entityResult.success || !entityResult.data) {
    return {
      title: 'Vendor Not Found',
    }
  }

  const entity = entityResult.data.data || entityResult.data
  
  return {
    title: `${entity.name} - GreenFood.live`,
    description: entity.description || `Shop from ${entity.name} on GreenFood.live`,
  }
}

export default async function VendorStorefrontPage({
  params,
}: {
  params: { locale: string; vendorId: string }
}) {
  // Fetch vendor entity
  await initializeDatabase()
  const db = getDatabaseService()
  
  const entityResult = await db.read('entities', params.vendorId)
  
  if (!entityResult.success || !entityResult.data) {
    notFound()
  }

  const vendorEntity = entityResult.data.data || entityResult.data

  // Verify it's a vendor entity
  if (vendorEntity.category !== 'vendor' || !vendorEntity.storeActivated) {
    notFound()
  }

  // Fetch vendor products (active only)
  const productsResult = await db.query<any>({
    collection: 'store_products',
    filters: [{
      field: 'entity_id',
      operator: '=',
      value: params.vendorId
    }, {
      field: 'status',
      operator: '=',
      value: 'active'
    }]
  })

  const products = productsResult.success && productsResult.data 
    ? (Array.isArray(productsResult.data) ? productsResult.data : (productsResult.data as any).data || [])
    : []

  return (
    <StoreWrapper locale={params.locale as 'en' | 'uk' | 'ru'}>
      <VendorStorefront 
        locale={params.locale}
        vendorEntity={vendorEntity}
        products={products}
      />
    </StoreWrapper>
  )
}

