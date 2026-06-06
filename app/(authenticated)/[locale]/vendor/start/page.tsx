import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorStartWrapper from '@/components/wrappers/vendor-start-wrapper'
import VendorOnboardingForm from './vendor-onboarding-form'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { logger } from '@/lib/logger'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params
  const t = await getTranslations('vendor.startPage');

  return {
    title: t('title') || 'Vendor Start',
    description: t('subtitle') || 'Start your vendor journey with Zemna AI.',
  }
}

export default async function VendorStartPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  logger.info('VendorStartPage: Starting');

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('VendorStartPage: Request details', { locale: validLocale, userAgent: headersList.get('user-agent') });

  try {
    logger.info('VendorStartPage: Authenticating session');
    const session = await auth();
    logger.info('VendorStartPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });

    if (!session?.user?.id) {
      logger.info('VendorStartPage: No session, redirecting to login');
      redirect(ROUTES.LOGIN(validLocale));
    }

    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration');
      const userExists = await userMigrationService.userDocumentExists(session.user.id);
      if (!userExists) {
        logger.warn('VendorStartPage: User document missing, initializing');
        await userMigrationService.ensureUserDocument(session.user as any);
        logger.info('VendorStartPage: User document created successfully');
      }
    } catch (migrationError) {
      logger.error('VendorStartPage: Failed to check/create user document:', migrationError);
    }

    const existingVendor = await getVendorEntity(session.user.id);
    if (existingVendor) {
      redirect(ROUTES.VENDOR_DASHBOARD(validLocale));
    }

    const t = await getTranslations('vendor.startPage');

    return (
    <VendorStartWrapper locale={validLocale} progressPercent={75}>
      {/* Content Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm mb-8">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('title') || 'Vendor Start'}</h1>
              <p className="text-muted-foreground">
                {t('subtitle') || 'Start your vendor journey with Zemna AI.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 max-w-4xl">
        <VendorOnboardingForm locale={validLocale} />
      </div>
    </VendorStartWrapper>
  );
  } catch (e) {
    logger.error('VendorStartPage: Error:', e);
    return (
      <>
        <title>Vendor Start Error | Zemna AI</title>
        <meta name="robots" content="noindex, nofollow" />
        <div className="container mx-auto px-0 py-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Vendor Start Error</h1>
            <p className="text-muted-foreground mb-4">Failed to load vendor start. Please try again later.</p>
            <a href={ROUTES.HOME(validLocale)} className="text-primary hover:underline">Return to Home</a>
          </div>
        </div>
      </>
    );
  }
}

