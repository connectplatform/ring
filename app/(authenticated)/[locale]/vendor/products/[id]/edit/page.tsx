import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import { getDatabaseService, initializeDatabase } from '@/lib/database/DatabaseService'
import ProductFormWrapper from '@/components/wrappers/product-form-wrapper'
import ProductForm from '../../product-form'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.products' })
  
  return {
    title: t('editProduct'),
    description: 'Edit product details',
  }
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }> | { locale: string; id: string }
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('VendorProductsEditPage: Starting');

  const resolvedParams = typeof (params as any).then === 'function' ? await (params as Promise<{ locale: string; id: string }>) : (params as { locale: string; id: string });
  const validLocale: Locale = routing.locales.includes(resolvedParams.locale as Locale) ? (resolvedParams.locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('VendorProductsEditPage: Request details', { locale: validLocale, id: resolvedParams.id, userAgent: headersList.get('user-agent') });

  try {
    logger.info('VendorProductsEditPage: Authenticating session');
    const session = await auth();
    logger.info('VendorProductsEditPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.info('VendorProductsEditPage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('VendorProductsEditPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('VendorProductsEditPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('VendorProductsEditPage: Failed to check/create user document:', migrationError);
    }

    const vendorEntity = await getVendorEntity(session.user.id);
    if (!vendorEntity) {
      redirect(ROUTES.VENDOR_START(validLocale));
    }

    await initializeDatabase();
    const db = getDatabaseService();
    const productResult = await db.read('store_products', resolvedParams.id);

    if (!productResult.success || !productResult.data) {
      notFound();
    }

    const product = productResult.data.data || productResult.data;

    if (product.entity_id !== vendorEntity.id) {
      redirect(ROUTES.VENDOR_PRODUCTS(validLocale));
    }

    return (
    <ProductFormWrapper locale={validLocale} mode="edit">
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
          locale={validLocale}
          vendorEntity={vendorEntity}
          existingProduct={product}
        />
      </div>
    </ProductFormWrapper>
  );
  } catch (e) {
    logger.error('VendorProductsEditPage: Error:', e);
    return (
      <>
        <title>Edit Product Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Edit Product Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load edit product page. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

