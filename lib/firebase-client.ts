import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { FirebaseInitializationError } from '@/lib/errors'

/**
 * Firebase client configuration — set NEXT_PUBLIC_FIREBASE_* in `.env.local`.
 */
const clientCredentials = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const PLACEHOLDER_VALUE =
  /^(your_|demo-|changeme|replace_me|xxx|todo)/i

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value?.trim()) return true
  const trimmed = value.trim()
  if (PLACEHOLDER_VALUE.test(trimmed)) return true
  if (trimmed.toLowerCase() === 'demo-api-key') return true
  return false
}

/**
 * True when all required Firebase client fields are present and not template placeholders.
 */
export function validateFirebaseConfig(): boolean {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId',
    'messagingSenderId',
  ] as const

  for (const field of requiredFields) {
    const value = clientCredentials[field]
    if (isPlaceholderValue(value)) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(
          `Firebase configuration missing or placeholder for "${field}". Set NEXT_PUBLIC_FIREBASE_* vars in .env.local to enable FCM push.`,
        )
      }
      return false
    }
  }

  return true
}

/** Web Push VAPID key — Firebase Console → Cloud Messaging → Web Push certificates. */
export function validateFcmVapidKey(): boolean {
  return !isPlaceholderValue(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)
}

/** Client FCM is usable only when Firebase app config and VAPID key are both valid. */
export function isFcmConfigured(): boolean {
  return validateFirebaseConfig() && validateFcmVapidKey()
}

let app: FirebaseApp | undefined
let db: Firestore | undefined
let auth: Auth | undefined

/**
 * Lazily initialize Firebase only when configuration is valid.
 * Skips init entirely when vars are unset — avoids Installations 400 on demo keys.
 */
function initializeFirebaseClient(): FirebaseApp | undefined {
  if (typeof window === 'undefined') return undefined
  if (getApps().length > 0) {
    app = getApps()[0]
    return app
  }
  if (!validateFirebaseConfig()) {
    return undefined
  }

  try {
    app = initializeApp(clientCredentials)
    db = getFirestore(app)
    auth = getAuth(app)
    return app
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
    throw new FirebaseInitializationError(
      'Firebase client initialization failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        timestamp: Date.now(),
        environment: process.env.NODE_ENV,
        hasValidConfig: true,
        userAgent: window.navigator.userAgent,
      },
    )
  }
}

if (typeof window !== 'undefined') {
  try {
    initializeFirebaseClient()
  } catch (error) {
    console.error('Firebase initialization failed:', error)
    app = undefined
    db = undefined
    auth = undefined
  }
}

export { app, db, auth }
