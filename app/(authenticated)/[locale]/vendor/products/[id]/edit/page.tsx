import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import ProductFormWrapper from '@/components/wrappers/product-form-wrapper'
import ProductForm from '../../product-form'
import { connection } from 'next/server'

export async function generateMetadata({ params }: { params: { locale: string; id: string } }) {
  await connection() // Next.js 16: opt out of prerendering

  const t = await getTranslations({ locale: params.locale, namespace: 'vendor.products' })
  
  return {
    title: t('editProduct'),
    description: 'Edit product details',
  }
}

export default async function EditProductPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  await connection() // Next.js 16: opt out of prerendering

  const session = await auth()
  
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(params.locale as any))
  }

  const vendorEntity = await getVendorEntity(session.user.id)
  
  if (!vendorEntity) {
    redirect(`/${params.locale}/vendor/start`)
  }

  // Fetch product
  await initializeDatabase()
  const db = getDatabaseService()
  const productResult = await db.read('store_products', params.id)
  
  if (!productResult.success || !productResult.data) {
    notFound()
  }

  const product = productResult.data.data || productResult.data

  // Verify ownership
  if (product.entity_id !== vendorEntity.id) {
    redirect(`/${params.locale}/vendor/products`)
  }

  return (
    <ProductFormWrapper locale={params.locale} mode="edit">
      {/* Content Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
            <p className="text-muted-foreground">
              Update your product information and settings
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 max-w-4xl">
        <ProductForm 
          mode="edit" 
          locale={params.locale}
          vendorEntity={vendorEntity}
          existingProduct={product}
        />
      </div>
    </ProductFormWrapper>
  )
}

