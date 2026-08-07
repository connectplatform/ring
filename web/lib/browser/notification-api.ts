/** Safe wrappers — iOS Safari / WKWebView often has no `Notification` global. */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) {
    return 'denied'
  }
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) {
    return 'denied'
  }
  return Notification.requestPermission()
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
): void {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return
  }
  try {
    new Notification(title, options)
  } catch (error) {
    console.warn('[FCM] Browser notification failed:', error)
  }
}
