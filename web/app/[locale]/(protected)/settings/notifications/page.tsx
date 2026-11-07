/**
 * Notification Settings Page
 * Dedicated page for managing notification preferences
 */

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import React from 'react';
import { NotificationPreferences } from '@/features/notifications/components/notification-preferences';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/shared';
import { getTranslations } from 'next-intl/server';
import NotificationsWrapper from '@/components/wrappers/notifications-wrapper';

interface NotificationSettingsPageProps {
  params: Promise<{
    locale: string;
  }>;
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'settings.notifications',
    pathname: '/settings/notifications',
    robots: { index: false, follow: false },
  })
}

export default async function NotificationSettingsPage({ params }: NotificationSettingsPageProps) {
  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.settings');

  return (
    <NotificationsWrapper locale={validLocale} showTitleRow={false}>
      <div className="w-full min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 py-2">
          <Link href={ROUTES.SETTINGS(validLocale)} className="flex items-center text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t('backToSettings')}
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.NOTIFICATIONS(validLocale)}>
              <Bell className="mr-2 h-4 w-4" />
              {t('viewNotifications')}
            </Link>
          </Button>
        </div>
        <NotificationPreferences />
      </div>
    </NotificationsWrapper>
  );
}
