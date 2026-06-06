import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ROUTES } from '@/constants/routes'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { routing } from '@/i18n/routing'
import ProductFormWrapper from '@/components/wrappers/product-form-wrapper'
import ProductForm from '../product-form'
import { connection } from 'next/server'
import type { Locale } from '@/i18n/shared'
import { logger } from '@/lib/logger'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.products' })
  
  return {
    title: t('addProduct'),
    description: 'Add a new product to your vendor store',
  }
}

export default async function AddProductPage({
  params,
}: {
  params: Promise<{ locale: string }> | { locale: string }
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('VendorProductsAddPage: Starting');

  const resolvedParams = typeof (params as any).then === 'function' ? await (params as Promise<{ locale: string }>) : (params as { locale: string });
  const validLocale: Locale = routing.locales.includes(resolvedParams.locale as Locale) ? (resolvedParams.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('VendorProductsAddPage: Request details', { locale: validLocale, userAgent: headersList.get('user-agent') });

  try {
    logger.info('VendorProductsAddPage: Authenticating session');
    const session = await auth();
    logger.info('VendorProductsAddPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.info('VendorProductsAddPage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('VendorProductsAddPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('VendorProductsAddPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('VendorProductsAddPage: Failed to check/create user document:', migrationError);
    }

    const vendorEntity = await getVendorEntity(session.user.id);
    if (!vendorEntity) {
      redirect(ROUTES.VENDOR_START(validLocale));
    }

    const t = await getTranslations({ locale: validLocale, namespace: 'vendor.products' });
    const tStore = await getTranslations({ locale: validLocale, namespace: 'store' });

    return (
    <ProductFormWrapper locale={validLocale} mode="create">
      {/* Content Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('addProduct') || tStore('addProduct') || 'Add Product'}
            </h1>
            <p className="text-muted-foreground">
              {tStore('addProductDescription') || 'Create and list a new product in your store'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 max-w-4xl">
        <ProductForm
          mode="create"
          locale={validLocale}
          vendorEntity={vendorEntity}
        />
      </div>
    </ProductFormWrapper>
  );
  } catch (e) {
    logger.error('VendorProductsAddPage: Error:', e);
    return (
      <>
        <title>Add Product Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Add Product Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load add product page. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

