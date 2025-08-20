/**
 * Test Notifications Page
 * Demo page for testing notification system functionality
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast, useToastHelpers } from '@/features/notifications/components/notification-provider';
import { NotificationType, NotificationPriority } from '@/features/notifications/types';
import { Bell, CheckCircle, AlertTriangle, Info, AlertCircle, Settings, List } from 'lucide-react';
import Link from 'next/link';

export default function TestNotificationsPage() {
  const { toast } = useToast();
  const { success, error, info, warning } = useToastHelpers();

  const showSampleToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    const messages = {
      success: {
        title: 'Success!',
        body: 'Your action was completed successfully.',
        type: NotificationType.SYSTEM_UPDATE
      },
      error: {
        title: 'Error Occurred',
        body: 'Something went wrong. Please try again.',
        type: NotificationType.SECURITY_ALERT
      },
      info: {
        title: 'Information',
        body: 'Here is some important information for you.',
        type: NotificationType.SYSTEM_MAINTENANCE
      },
      warning: {
        title: 'Warning',
        body: 'Please review this important notice.',
        type: NotificationType.KYC_EXPIRING
      }
    };

    const message = messages[type];
    toast({
      title: message.title,
      body: message.body,
      type: message.type,
      priority: NotificationPriority.NORMAL
    });
  };

  const showCustomToast = () => {
    toast({
      title: 'New Opportunity Available',
      body: 'A new investment opportunity matching your criteria has been posted.',
      type: NotificationType.OPPORTUNITY_CREATED,
      priority: NotificationPriority.HIGH,
      actionText: 'View Opportunity',
      actionUrl: '/opportunities/123'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Notification System Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the Ring platform notification system components and functionality
          </p>
        </div>

        {/* Toast Notifications Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Toast Notifications
            </CardTitle>
            <CardDescription>
              Test different types of toast notifications with various priorities and actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                onClick={() => showSampleToast('success')}
                className="bg-green-500 hover:bg-green-600"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Success Toast
              </Button>
              
              <Button
                onClick={() => showSampleToast('error')}
                className="bg-red-500 hover:bg-red-600"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Error Toast
              </Button>
              
              <Button
                onClick={() => showSampleToast('info')}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Info className="w-4 h-4 mr-2" />
                Info Toast
              </Button>
              
              <Button
                onClick={() => showSampleToast('warning')}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Warning Toast
              </Button>
            </div>
            
            <div className="pt-4 border-t">
              <Button
                onClick={showCustomToast}
                variant="outline"
                className="w-full"
              >
                Show Custom Notification Toast
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Integration */}
        <Card>
          <CardHeader>
            <CardTitle>Navigation Integration</CardTitle>
            <CardDescription>
              The notification center is integrated into the main navigation bar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Notification Center
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Look for the bell icon in the top navigation bar (visible when logged in). 
                  Click it to open the notification center with filtering, search, and management options.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h5 className="font-medium mb-2">Features Available:</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• Real-time notification count badge</li>
                    <li>• Dropdown with search and filters</li>
                    <li>• Mark individual/all as read</li>
                    <li>• Pagination and load more</li>
                    <li>• Direct links to notification settings</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h5 className="font-medium mb-2">Pages Available:</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <li>• <Link href="/notifications" className="text-blue-600 hover:underline">/notifications</Link> - Full notification list</li>
                    <li>• <Link href="/settings/notifications" className="text-blue-600 hover:underline">/settings/notifications</Link> - Preferences</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Status */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Status</CardTitle>
            <CardDescription>
              Current status of notification system components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-green-600 dark:text-green-400 mb-3">✅ Completed</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Toast Notification System
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Notification Center Component
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Notification List with Filtering
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Notification Preferences Dashboard
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Navigation Integration
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Global Notification Provider
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    Comprehensive Hook System
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-3">🔄 Backend Ready</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <Info className="w-4 h-4 text-blue-500 mr-2" />
                    API Endpoints (Implemented)
                  </li>
                  <li className="flex items-center">
                    <Info className="w-4 h-4 text-blue-500 mr-2" />
                    Database Schema (Ready)
                  </li>
                  <li className="flex items-center">
                    <Info className="w-4 h-4 text-blue-500 mr-2" />
                    Service Layer (Complete)
                  </li>
                  <li className="flex items-center">
                    <Info className="w-4 h-4 text-blue-500 mr-2" />
                    Event Triggers (Implemented)
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              Recommended next steps for full notification system deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                  Ready for Production Testing
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  All UI components are complete and ready for integration with your existing notification backend.
                  Test with real data by ensuring your API endpoints return the expected notification format.
                </p>
              </div>
              
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Test notification center with real user data</li>
                <li>Configure notification preferences for different user roles</li>
                <li>Set up real-time notification delivery (WebSocket/SSE)</li>
                <li>Implement email/SMS delivery channels</li>
                <li>Add push notification support</li>
                <li>Configure notification triggers for platform events</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 