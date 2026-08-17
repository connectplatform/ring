import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { FirebaseInitializationError } from '@/lib/errors'
import {
  isFirebasePlaceholderValue,
  validateFcmVapidKey,
} from '@/lib/firebase-public-env'
import concrete from '@/ring-config.json'

export { getFcmVapidKey, validateFcmVapidKey } from '@/lib/firebase-public-env'

/**
 * Firebase client SDK — browser-only initialization.
 *
 * Single entry point for the browser Firebase app in `firebase-full` mode
 * (and for FCM push in any `DB_BACKEND_MODE`).
 *
 * - Getters are **lazy**, **window-guarded**, and use **module singletons**.
 *   Safe to import from shared modules; they return `undefined` during SSR.
 * - Init is gated by `integrations.firebase` in ring-config.json:
 *   FCM-only clones set `enabled: false`, `fcmEnabled: true`, `firestoreEnabled: false`
 *   so `initializeApp` runs without Auth/Firestore.
 * - Do **not** wrap these getters in React `cache()` — that API is for
 *   server request dedup (`firebase-service-manager.ts` / Admin). This
 *   module is imported by `'use client'` hooks (`use-fcm`).
 * - Prefer `getFirebaseClientApp()` over the live `app` export.
 * - Server-side Firebase: `lib/firebase-admin.server.ts`.
 *
 * Emulator: `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` connects Firestore/Auth/Storage
 * to the Local Emulator Suite (`localhost:8080` / `9099` / `9199`).
 */

type FirebaseIntegrationFlags = {
  enabled?: boolean
  fcmEnabled?: boolean
  firestoreEnabled?: boolean
}

function firebaseFlags(): FirebaseIntegrationFlags {
  const integrations = (concrete as { integrations?: { firebase?: FirebaseIntegrationFlags } })
    .integrations
  return integrations?.firebase ?? {}
}

/** Cloud Messaging — independent of Auth/Firestore. */
export function isFcmFeatureEnabled(): boolean {
  return firebaseFlags().fcmEnabled === true
}

/** Firebase Auth / general client app. Off for FCM-only clones. */
export function isFirebaseAuthEnabled(): boolean {
  return firebaseFlags().enabled === true
}

/** Client Firestore. Off for FCM-only clones. */
export function isFirebaseFirestoreEnabled(): boolean {
  return firebaseFlags().firestoreEnabled === true
}

function isFirebaseClientAppWanted(): boolean {
  return isFcmFeatureEnabled() || isFirebaseAuthEnabled() || isFirebaseFirestoreEnabled()
}

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
    if (isFirebasePlaceholderValue(value)) {
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

/** Client FCM is usable when the clone enables FCM, app config, and Console Web Push certificate are present. */
export function isFcmConfigured(): boolean {
  return isFcmFeatureEnabled() && validateFirebaseConfig() && validateFcmVapidKey()
}

/**
 * True when the Firebase emulator suite should be auto-connected in the
 * browser. Toggle via `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` in `.env.local`.
 */
export function isEmulatorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === '1'
}

// ============================================================================
// Internal state — module-level singletons (browser process, not React cache).
// ============================================================================

let app: FirebaseApp | undefined
let db: Firestore | undefined
let auth: Auth | undefined
let storage: ReturnType<typeof import('firebase/storage').getStorage> | undefined
let ai: ReturnType<typeof import('firebase/ai').getAI> | undefined
let emulatorConnected = false

/**
 * Lazily initialize Firebase only when configuration is valid.
 * Skips init entirely when vars are unset — avoids Installations 400 on demo keys.
 *
 * @throws FirebaseInitializationError if config is valid but init fails
 */
function initializeFirebaseClient(): FirebaseApp | undefined {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseClientAppWanted()) return undefined
  if (getApps().length > 0) {
    app = getApps()[0]
    return app
  }
  if (!validateFirebaseConfig()) {
    return undefined
  }

  try {
    app = initializeApp(clientCredentials)
    if (isFirebaseFirestoreEnabled()) {
      db = getFirestore(app)
    }
    if (isFirebaseAuthEnabled()) {
      auth = getAuth(app)
    }
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

// Auto-init on browser load — kept for backward compatibility with `import { app } from '@/lib/firebase-client'`
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

// ============================================================================
// Lazy getters (module singletons + window guards). Storage / AI / emulator
// helpers use `await import()` — never `require()`.
// ============================================================================

/**
 * Lazy getter for the browser FirebaseApp.
 * Returns `undefined` during SSR, on placeholder config, or when init failed.
 */
export function getFirebaseClientApp(): FirebaseApp | undefined {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseClientAppWanted()) return undefined
  if (app) return app
  if (getApps().length > 0) {
    app = getApps()[0]
    return app
  }
  return initializeFirebaseClient()
}

/**
 * Lazy getter for the browser Firestore instance.
 */
export function getFirebaseFirestoreClient(): Firestore | undefined {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseFirestoreEnabled()) return undefined
  const a = getFirebaseClientApp()
  if (!a) return undefined
  if (!db) db = getFirestore(a)
  if (isEmulatorEnabled() && !emulatorConnected) {
    void connectFirebaseClientEmulator()
  }
  return db
}

/**
 * Lazy getter for the browser Auth instance.
 */
export function getFirebaseAuthClient(): Auth | undefined {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseAuthEnabled()) return undefined
  const a = getFirebaseClientApp()
  if (!a) return undefined
  if (!auth) auth = getAuth(a)
  if (isEmulatorEnabled() && !emulatorConnected) {
    void connectFirebaseClientEmulator()
  }
  return auth
}

/**
 * Lazy getter for the browser Storage instance.
 * Dynamic-imports `firebase/storage` so the SDK loads only when used.
 */
export async function getFirebaseStorageClient(): Promise<
  ReturnType<typeof import('firebase/storage').getStorage> | undefined
> {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseAuthEnabled() && !isFirebaseFirestoreEnabled()) return undefined
  if (storage) return storage
  const a = getFirebaseClientApp()
  if (!a) return undefined
  try {
    const { getStorage, connectStorageEmulator } = await import('firebase/storage')
    storage = getStorage(a)
    if (isEmulatorEnabled() && !emulatorConnected) {
      try {
        connectStorageEmulator(storage, 'localhost', 9199)
      } catch (err) {
        console.warn('[firebase-client] Storage emulator connect failed', err)
      }
    }
    return storage
  } catch (err) {
    console.error('[firebase-client] Storage init failed', err)
    return undefined
  }
}

/**
 * Lazy getter for Firebase AI Logic (`firebase/ai`).
 *
 * @see https://firebase.google.com/docs/ai-logic
 */
export async function getFirebaseAIClient(): Promise<
  ReturnType<typeof import('firebase/ai').getAI> | undefined
> {
  if (typeof window === 'undefined') return undefined
  if (!isFirebaseAuthEnabled() && !isFirebaseFirestoreEnabled()) return undefined
  if (ai) return ai
  const a = getFirebaseClientApp()
  if (!a) return undefined
  try {
    const { getAI } = await import('firebase/ai')
    ai = getAI(a)
    return ai
  } catch (err) {
    console.error('[firebase-client] AI Logic init failed', err)
    return undefined
  }
}

/**
 * SSR-safe check: returns true when the client app is initialized and ready.
 */
export function isFirebaseClientReady(): boolean {
  if (typeof window === 'undefined') return false
  return getApps().length > 0 && !!getFirebaseClientApp()
}

/**
 * Clear cached singletons — TEST-ONLY. Do not call from production code.
 */
export function _resetFirebaseClientForTests(): void {
  app = undefined
  db = undefined
  auth = undefined
  storage = undefined
  ai = undefined
  emulatorConnected = false
}

/**
 * Best-effort explicit emulator connection. Idempotent.
 * Called automatically by the getters when `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`.
 * Can be called manually for finer control (e.g. custom host/port).
 */
export async function connectFirebaseClientEmulator(options?: {
  firestoreHost?: string
  firestorePort?: number
  authHost?: string
  authPort?: number
  storageHost?: string
  storagePort?: number
}): Promise<void> {
  if (typeof window === 'undefined') return
  if (emulatorConnected) return
  if (process.env.NODE_ENV === 'production' && !isEmulatorEnabled()) return

  const firestoreHost = options?.firestoreHost ?? 'localhost'
  const firestorePort = options?.firestorePort ?? 8080
  const authHost = options?.authHost ?? 'localhost'
  const authPort = options?.authPort ?? 9099
  const storageHost = options?.storageHost ?? 'localhost'
  const storagePort = options?.storagePort ?? 9199

  const a = getFirebaseClientApp()
  if (!a) return
  if (isFirebaseFirestoreEnabled() && !db) db = getFirestore(a)
  if (isFirebaseAuthEnabled() && !auth) auth = getAuth(a)

  if (db) {
    try {
      const { connectFirestoreEmulator } = await import('firebase/firestore')
      connectFirestoreEmulator(db, firestoreHost, firestorePort)
    } catch (err) {
      console.warn('[firebase-client] Firestore emulator connect failed', err)
    }
  }
  if (auth) {
    try {
      const { connectAuthEmulator } = await import('firebase/auth')
      connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true })
    } catch (err) {
      console.warn('[firebase-client] Auth emulator connect failed', err)
    }
  }
  if (!storage && (isFirebaseAuthEnabled() || isFirebaseFirestoreEnabled())) {
    try {
      const { getStorage, connectStorageEmulator } = await import('firebase/storage')
      storage = getStorage(a)
      connectStorageEmulator(storage, storageHost, storagePort)
    } catch (err) {
      console.warn('[firebase-client] Storage emulator connect failed', err)
    }
  }
  emulatorConnected = true
}

// ============================================================================
// Backward-compatible module-level exports. Prefer getFirebaseClientApp() /
// getFirebaseFirestoreClient() / getFirebaseAuthClient() in new code.
// ============================================================================

export { app, db, auth }
