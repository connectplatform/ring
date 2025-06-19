/**
 * React 19 Enhanced Navigation Hook for Notifications
 * Uses startTransition for smooth, non-blocking navigation
 */

'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useCallback } from 'react';

export interface NotificationNavigationOptions {
  replace?: boolean;
  scroll?: boolean;
}

export function useNotificationNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Navigate to notification action URL
  const navigateToNotification = useCallback((
    url: string, 
    options: NotificationNavigationOptions = {}
  ) => {
    startTransition(() => {
      if (options.replace) {
        router.replace(url, { scroll: options.scroll });
      } else {
        router.push(url, { scroll: options.scroll });
      }
    });
  }, [router]);

  // Navigate to notification settings
  const navigateToSettings = useCallback((options: NotificationNavigationOptions = {}) => {
    startTransition(() => {
      if (options.replace) {
        router.replace('/settings/notifications', { scroll: options.scroll });
      } else {
        router.push('/settings/notifications', { scroll: options.scroll });
      }
    });
  }, [router]);

  // Navigate to full notifications list
  const navigateToNotificationsList = useCallback((options: NotificationNavigationOptions = {}) => {
    startTransition(() => {
      if (options.replace) {
        router.replace('/notifications', { scroll: options.scroll });
      } else {
        router.push('/notifications', { scroll: options.scroll });
      }
    });
  }, [router]);

  // Navigate to home/dashboard
  const navigateToHome = useCallback((options: NotificationNavigationOptions = {}) => {
    startTransition(() => {
      if (options.replace) {
        router.replace('/', { scroll: options.scroll });
      } else {
        router.push('/', { scroll: options.scroll });
      }
    });
  }, [router]);

  // Generic navigation function
  const navigateTo = useCallback((
    path: string, 
    options: NotificationNavigationOptions = {}
  ) => {
    startTransition(() => {
      if (options.replace) {
        router.replace(path, { scroll: options.scroll });
      } else {
        router.push(path, { scroll: options.scroll });
      }
    });
  }, [router]);

  // Navigation with external URL handling
  const navigateToUrl = useCallback((url: string) => {
    // Check if it's an external URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // For external URLs, use window.open for security
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // For internal URLs, use React 19 navigation
      navigateTo(url);
    }
  }, [navigateTo]);

  return {
    // Navigation functions
    navigateToNotification,
    navigateToSettings,
    navigateToNotificationsList,
    navigateToHome,
    navigateTo,
    navigateToUrl,
    
    // State
    isPending,
    
    // Utilities
    isNavigating: isPending
  };
} 