import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorProductsWrapper from '@/components/wrappers/vendor-products-wrapper'
import VendorProductsList from './vendor-products-list'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'vendor.products' })
  
  return {
    title: t('title'),
    description: t('myProducts'),
  }
}

export default async function VendorProductsPage({
  params,
}: {
  params: { locale: string }
}) {
  const session = await auth()
  
  // Require authentication
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(params.locale))
  }

  // Check vendor access
  const vendorEntity = await getVendorEntity(session.user.id)
  
  if (!vendorEntity) {
    redirect(`/${params.locale}/vendor/start`)
  }

  return (
    <VendorProductsWrapper locale={params.locale}>
      <div className="container mx-auto px-6 max-w-6xl">
        <VendorProductsList 
          locale={params.locale} 
          vendorEntityId={vendorEntity.id}
        />
      </div>
    </VendorProductsWrapper>
  )
}

