/**
 * Public Firebase / FCM env helpers — no Firebase SDK imports.
 * Safe in Route Handlers, tests, and `'use client'` hooks.
 */

const PLACEHOLDER_VALUE = /^(your_|demo-|changeme|replace_me|xxx|todo)/i

export function isFirebasePlaceholderValue(value: string | undefined): boolean {
  if (!value?.trim()) return true
  const trimmed = value.trim()
  if (PLACEHOLDER_VALUE.test(trimmed)) return true
  if (trimmed.toLowerCase() === 'demo-api-key') return true
  return false
}

/** Web Push certificate from Firebase Console (public). Trimmed; null if missing/placeholder. */
export function getFcmVapidKey(): string | null {
  const key = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()
  if (!key || isFirebasePlaceholderValue(key)) return null
  return key
}

export function validateFcmVapidKey(): boolean {
  return getFcmVapidKey() !== null
}
