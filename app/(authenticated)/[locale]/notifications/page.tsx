/**
 * Notifications Page
 * Dedicated page for viewing and managing all notifications
 */

import React from 'react';
import { Metadata } from 'next';
import { NotificationList } from '@/features/notifications/components/notification-list';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Notifications | Ring Platform',
  description: 'View and manage your notifications on the Ring platform',
};

interface NotificationsPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Stay up to date with all your Ring platform activities
            </p>
          </div>
        </div>

        {/* Notification List */}
        <NotificationList />
      </div>
    </div>
  );
} 