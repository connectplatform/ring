/**
 * Notification Service Loader
 *
 * Lazy-loads notification service to avoid Firebase initialization during build
 * when running in PostgreSQL-only mode (DB_HYBRID_MODE=false)
 *
 * Firebase services are only loaded at runtime, never during build time.
 */

// Only enable notification service when Firebase is available
const isFirebaseMode = process.env.DB_HYBRID_MODE !== 'false';

let notificationServiceModule: any = null;
let isRuntime = false;

// Check if we're at runtime (not build time)
if (typeof window === 'undefined') {
  // Server-side: check if we have runtime environment variables
  // This will be false during build time, true during runtime
  isRuntime = !!process.env.NODE_ENV && process.env.NODE_ENV !== 'production';
}

export function getNotificationService() {
  if (!isFirebaseMode || !isRuntime) {
    return null;
  }

  if (!notificationServiceModule) {
    try {
      notificationServiceModule = require('./notification-service');
    } catch (error) {
      console.warn('Failed to load notification service (Firebase may not be available):', error.message);
      return null;
    }
  }

  return notificationServiceModule;
}

export function isNotificationServiceAvailable(): boolean {
  return isFirebaseMode && isRuntime;
}

