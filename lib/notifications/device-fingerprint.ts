/**
 * Stable browser device id for FCM token upsert (one row per user + device).
 */
const STORAGE_KEY = 'ring_fcm_device_fingerprint'

export function getOrCreateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing && /^[a-zA-Z0-9\-_]{1,128}$/.test(existing)) {
    return existing
  }

  const fingerprint =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `web_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`

  localStorage.setItem(STORAGE_KEY, fingerprint)
  return fingerprint
}
