/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { NotificationList } from '@/features/notifications/components/notification-list';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/shared';
import NotificationsWrapper from '@/components/wrappers/notifications-wrapper';
import { connection } from 'next/server';
import { routing } from '@/i18n/routing';
import { headers } from 'next/headers';
import { auth } from '@/auth';
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
    <NotificationsWrapper locale={validLocale}>
      <>
        {/* React 19 Native Document Metadata - Authenticated Page */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Authenticated page security meta tags */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        <div className="min-h-[60vh]">
          {/* Notification List — title row moved to right-sidebar (site-wide pattern) */}
          <NotificationList />
        </div>
      </>
    </NotificationsWrapper>
  );
}
