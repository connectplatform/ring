import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorProductsWrapper from '@/components/wrappers/vendor-products-wrapper'
import VendorProductsList from './vendor-products-list'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.products' })
  
  return {
    title: t('title'),
    description: t('myProducts'),
  }
}

export default async function VendorProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('VendorProductsPage: Starting');

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('VendorProductsPage: Request details', { locale: validLocale, userAgent: headersList.get('user-agent') });

  try {
    logger.info('VendorProductsPage: Authenticating session');
    const session = await auth();
    logger.info('VendorProductsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.info('VendorProductsPage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('VendorProductsPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('VendorProductsPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('VendorProductsPage: Failed to check/create user document:', migrationError);
    }

    const vendorEntity = await getVendorEntity(session.user.id);
    if (!vendorEntity) {
      redirect(ROUTES.VENDOR_START(validLocale));
    }

    return (
      <VendorProductsWrapper locale={validLocale}>
        <div className="container mx-auto px-6 max-w-6xl">
          <VendorProductsList locale={validLocale} vendorEntityId={vendorEntity.id} />
        </div>
      </VendorProductsWrapper>
    );
  } catch (e) {
    logger.error('VendorProductsPage: Error:', e);
    return (
      <>
        <title>Vendor Products Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Vendor Products Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load vendor products. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

