/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata, RING_PLATFORM_SEO } from '@/lib/seo-metadata'
import { NotificationList } from '@/features/notifications/components/notification-list';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/shared';
import SettingsWrapper from '@/components/wrappers/settings-wrapper';
import { connection } from 'next/server';
import { routing } from '@/i18n/routing';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { ROUTES } from '@/constants/routes';
import { logger } from '@/lib/logger';

interface NotificationsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: NotificationsPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'notifications',
    pathname: '/notifications',
    siteName: RING_PLATFORM_SEO.siteName,
    twitterSite: RING_PLATFORM_SEO.twitterSite,
    robots: { index: false, follow: false },
  })
}
export default async function NotificationsPage({ params }: NotificationsPageProps) {
  await connection();

  logger.info('NotificationsPage: Starting');

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);

  const headersList = await headers();
  logger.info('NotificationsPage: Request details', { locale: validLocale, userAgent: headersList.get('user-agent') });

  const session = await auth();
  logger.info('NotificationsPage: Session authenticated', { sessionExists: !!session, userId: session?.user?.id });
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  try {
    const { userMigrationService } = await import('@/features/auth/services/user-migration');
    const userExists = await userMigrationService.userDocumentExists(session.user.id);
    if (!userExists) {
      logger.warn('NotificationsPage: User document missing, initializing');
      await userMigrationService.ensureUserDocument(session.user as any);
      logger.info('NotificationsPage: User document created successfully');
    }
  } catch (migrationError) {
    logger.error('NotificationsPage: Failed to check/create user document:', migrationError);
  }

    const t = await getTranslations('notifications');
    const title = `${t('metadata.title') || 'Notifications'} | Zemna AI`;
    const description = t('metaDescription.description') || 'View and manage your notifications on the Zemna AI platform';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://zemna.ai';
    const canonicalUrl = validLocale === routing.defaultLocale ? `${baseUrl}/notifications` : `${baseUrl}/${validLocale}/notifications`;

    return (
    <SettingsWrapper locale={validLocale}>
      <>
        {/* React 19 Native Document Metadata - Authenticated Page */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Authenticated page security meta tags */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Dashboard
                  </Link>
                </div>
                
                <Link href="/settings/notifications">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Notification Settings
                  </Button>
                </Link>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Notifications
                </h1>
                <p className="text-muted-foreground mt-2">
                  Stay up to date with all your Zemna AI activities
                </p>
              </div>
            </div>

            {/* Notification List */}
            <NotificationList />
          </div>
        </div>
      </>
    </SettingsWrapper>
  );
} 