/**
 * Notification Service Loader
 * 
 * Lazy-loads notification service to avoid Firebase initialization during build
 * when running in PostgreSQL-only mode (DB_HYBRID_MODE=false)
 */

// Only load notification service when Firebase is available
const isFirebaseMode = process.env.DB_HYBRID_MODE !== 'false';

let notificationServiceModule: any = null;

export function getNotificationService() {
  if (!isFirebaseMode) {
    return null;
  }

  if (!notificationServiceModule) {
    notificationServiceModule = require('./notification-service');
  }

  return notificationServiceModule;
}

export function isNotificationServiceAvailable(): boolean {
  return isFirebaseMode;
}

