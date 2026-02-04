/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import React from 'react';
import { NotificationList } from '@/features/notifications/components/notification-list';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import SettingsWrapper from '@/components/wrappers/settings-wrapper';

interface NotificationsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const translations = await loadTranslations(validLocale);
  
  // Basic metadata for authenticated page (no SEO needed)
  const title = `${(translations as any).notifications?.title || 'Notifications'} | Ring Platform`;
  const description = (translations as any).notifications?.description || 'View and manage your notifications on the Ring platform';
  const canonicalUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ring.platform"}/${validLocale}/notifications`;

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
                  Stay up to date with all your Ring platform activities
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