import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { loadTranslations, isValidLocale, defaultLocale, generateHreflangAlternates } from '@/i18n-config'
import ProductFormWrapper from '@/components/wrappers/product-form-wrapper'
import ProductForm from '../product-form'

export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'vendor.products' })
  
  return {
    title: t('addProduct'),
    description: 'Add a new product to your vendor store',
  }
}

export default async function AddProductPage({
  params,
}: {
  params: { locale: string }
}) {
  const locale = isValidLocale(params.locale) ? params.locale : defaultLocale;
  const translations = await loadTranslations(locale);
  const alternates = generateHreflangAlternates('/vendor/products/add');

  const session = await auth()

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/signin`)
  }

  const vendorEntity = await getVendorEntity(session.user.id)

  if (!vendorEntity) {
    redirect(`/${locale}/vendor/start`)
  }

  return (
    <ProductFormWrapper locale={locale} mode="create">
      {/* Content Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {(translations as any)?.modules?.store?.addProduct || 'Add Product'}
            </h1>
            <p className="text-muted-foreground">
              {(translations as any)?.modules?.store?.addProductDescription || 'Create and list a new product in your store'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 max-w-4xl">
        <ProductForm
          mode="create"
          locale={params.locale}
          vendorEntity={vendorEntity}
        />
      </div>
    </ProductFormWrapper>
  )
}

