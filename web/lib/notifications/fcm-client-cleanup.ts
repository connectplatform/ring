import { unregisterFcmToken } from '@/app/_actions/fcm'
import { unregisterPushSubscription } from '@/app/_actions/push'
import { getOrCreateDeviceFingerprint } from '@/lib/notifications/device-fingerprint'

/**
 * Unregister this browser's FCM token before session ends (logout / disable notifications).
 * Must run while the user is still authenticated.
 */
export async function unregisterCurrentDeviceFcmToken(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const deviceFingerprint = getOrCreateDeviceFingerprint()
    if (!deviceFingerprint) {
      return
    }

    const result = await unregisterFcmToken({ deviceFingerprint })
    if ('error' in result) {
      console.warn('FCM unregister failed:', result.error)
    }
  } catch (error) {
    console.warn('FCM unregister error:', error)
  }
}

/** Drop RFC PushManager subscription + push_subscriptions row for this device. */
export async function unregisterCurrentDeviceRfcPush(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map(async (registration) => {
          const sub = await registration.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        }),
      )
    }
  } catch (error) {
    console.warn('RFC PushManager unsubscribe failed:', error)
  }

  try {
    const deviceFingerprint = getOrCreateDeviceFingerprint()
    if (!deviceFingerprint) return
    const result = await unregisterPushSubscription({ deviceFingerprint })
    if ('error' in result) {
      console.warn('RFC push unregister failed:', result.error)
    }
  } catch (error) {
    console.warn('RFC push unregister error:', error)
  }
}

/** Disable both FCM and RFC stacks for this browser (logout / settings). */
export async function unregisterCurrentDevicePush(): Promise<void> {
  await unregisterCurrentDeviceFcmToken()
  await unregisterCurrentDeviceRfcPush()
}
