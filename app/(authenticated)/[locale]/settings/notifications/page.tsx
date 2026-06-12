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
import AboutWrapper from '@/components/wrappers/about-wrapper';
import { ROUTES } from '@/constants/routes';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/shared';
import { getTranslations } from 'next-intl/server';

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
    <AboutWrapper locale={validLocale}>
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Link href={ROUTES.SETTINGS(validLocale)} className="flex items-center text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5 mr-2" />
                {t('backToSettings') || 'Back to Settings'}
              </Link>
            </div>
            
            <Link href={ROUTES.NOTIFICATIONS(validLocale)}>
              <Button variant="outline" size="sm">
                <Bell className="w-4 h-4 mr-2" />
                {t('viewNotifications') || 'View Notifications'}  
              </Button>
            </Link>
          </div>
        </div>

        {/* Notification Preferences */}
        <NotificationPreferences />
      </div>
    </AboutWrapper>
  );
} 