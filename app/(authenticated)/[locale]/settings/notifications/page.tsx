/**
 * Notification Settings Page
 * Dedicated page for managing notification preferences
 */

import React from 'react';
import { Metadata } from 'next';
import { NotificationPreferences } from '@/features/notifications/components/notification-preferences';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell } from 'lucide-react';
import Link from 'next/link';
import SettingsWrapper from '@/components/wrappers/settings-wrapper';

export const metadata: Metadata = {
  title: 'Notification Settings | Ring Platform',
  description: 'Manage your notification preferences on the Ring platform',
};

interface NotificationSettingsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function NotificationSettingsPage({ params }: NotificationSettingsPageProps) {
  const { locale } = await params;

  return (
    <SettingsWrapper locale={locale as 'en' | 'uk' | 'ru'}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <Link href="/settings" className="flex items-center text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Settings
                </Link>
              </div>
              
              <Link href="/notifications">
                <Button variant="outline" size="sm">
                  <Bell className="w-4 h-4 mr-2" />
                  View Notifications
                </Button>
              </Link>
            </div>
          </div>

          {/* Notification Preferences */}
          <NotificationPreferences />
        </div>
      </div>
    </SettingsWrapper>
  );
} 