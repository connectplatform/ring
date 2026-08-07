import { unregisterFcmToken } from '@/app/_actions/fcm'
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
