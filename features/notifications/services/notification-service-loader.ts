/**
 * Notification Service Loader
 *
 * Lazy-loads notification service to avoid Firebase initialization during build
 * when running in PostgreSQL-only mode (DB_HYBRID_MODE=false)
 *
 * Firebase services are only loaded at runtime, never during build time.
 */

// Only enable notification service when Firebase hybrid mode is on (Postgres + FCM).
const isFirebaseMode = process.env.DB_HYBRID_MODE !== 'false'

let notificationServiceModule: typeof import('./notification-service') | null = null

export function getNotificationService() {
  if (!isFirebaseMode) {
    return null
  }

  if (!notificationServiceModule) {
    try {
      notificationServiceModule = require('./notification-service') as typeof import('./notification-service')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('Failed to load notification service (Firebase may not be available):', message)
      return null
    }
  }

  return notificationServiceModule
}

export function isNotificationServiceAvailable(): boolean {
  return isFirebaseMode
}

