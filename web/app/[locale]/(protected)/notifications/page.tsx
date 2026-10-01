/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { NotificationList } from '@/features/notifications/components/notification-list';
import type { Locale } from '@/i18n/shared';
import NotificationsWrapper from '@/components/wrappers/notifications-wrapper';
import { connection } from 'next/server';
import { routing } from '@/i18n/routing';
import { auth } from '@/auth';

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

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);

  const session = await auth();
  if (!session) return null // Layout AuthGuard already redirects; this narrowing satisfies TypeScript

  return (
    <NotificationsWrapper locale={validLocale}>
      <div className="min-h-[60vh] py-6">
        {/* Notification List — title row lives in right rail (site-wide pattern) */}
        <NotificationList />
      </div>
    </NotificationsWrapper>
  );
}
