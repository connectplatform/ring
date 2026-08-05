import { cache } from 'react'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { FirebaseInitializationError } from '@/lib/errors'

/**
 * Firebase client SDK — react19-native browser-only initialization.
 *
 * This module is the **single entry point** for the browser-side Firebase
 * app in `firebase-full` ring-db mode (and for FCM push in any mode).
 *
 * ## React 19 native patterns
 *
 * - All getters are **lazy** (called only on first use) and **window-guarded**
 *   (`typeof window !== 'undefined'`) so they're safe to import from
 *   Server Components / Server Actions / shared modules without crashing.
 * - `getFirebaseClientApp()` is wrapped in React 19 `cache()` so multiple
 *   Server Components in the same request cycle share one client instance.
 * - `getFirebaseFirestoreClient()` and `getFirebaseAuthClient()` are
 *   paired with `getFirebaseStorageClient()` and the AI Logic client
 *   for the planned `use-firebase` hook family (see
 *   `AI-LEGIOX/legiox-truth-lens/ring-backend-administrator.nodus.json`).
 *
 * ## Browser-only safety
 *
 * The Firebase JS SDK is a browser-only library — it must never be imported
 * into Server Components, Server Actions, or shared modules that get
 * bundled into Node.js. Every public export in this file is window-guarded.
 * If you need server-side Firebase, use `lib/firebase-admin.server.ts` instead.
 *
 * ## Emulator support
 *
 * In `NODE_ENV=development`, set `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` to
 * auto-connect Firestore/Auth/Storage to the Firebase Local Emulator Suite
 * (defaults to `localhost:8080` / `9099` / `9199`).
 */

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

const PLACEHOLDER_VALUE = /^(your_|demo-|changeme|replace_me|xxx|todo)/i

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

/** Web Push certificate from Firebase Console (public). Trimmed; null if missing/placeholder. */
export function getFcmVapidKey(): string | null {
  const key = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()
  if (!key || isPlaceholderValue(key)) return null
  return key
}

/** Web Push VAPID key — Firebase Console → Cloud Messaging → Web Push certificates. */
export function validateFcmVapidKey(): boolean {
  return getFcmVapidKey() !== null
}

/**
 * Propagation leak detector: ring-main VAPID (BKQ4OAwA…) copied into other Firebase projects
 * causes FCM `token-subscribe-failed` / missing authentication credential in the browser.
 */
export function isKnownCrossProjectVapidLeak(): boolean {
  const vapid = getFcmVapidKey()
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  if (!vapid || !projectId) return false
  const isRingMainVapid =
    vapid.startsWith('BKQ4OAwA-') || vapid.startsWith('BKQ4OAwA')
  const isRingMainProject = projectId === 'ring-main'
  return isRingMainVapid && !isRingMainProject
}

/** Client FCM is usable only when Firebase app config and VAPID key are both valid. */
export function isFcmConfigured(): boolean {
  return validateFirebaseConfig() && validateFcmVapidKey() && !isKnownCrossProjectVapidLeak()
}

/**
 * True when the Firebase emulator suite should be auto-connected in the
 * browser. Toggle via `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` in `.env.local`.
 */
export function isEmulatorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === '1'
}

// ============================================================================
// Internal state — module-level singletons. Kept in module scope so React 19
// `cache()` can dedupe across Server Component renders within one request.
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
// React 19 native getters (cache()-wrapped for SSG/SSR dedup)
//
// Pair with the planned use-firebase hook family (hooks/use-firebase.ts):
//   const app    = useFirebaseApp();          // -> getFirebaseClientApp()
//   const db     = useFirestore();           // -> getFirebaseFirestoreClient()
//   const auth   = useFirebaseAuth();        // -> getFirebaseAuthClient()
//   const stor   = useFirebaseStorage();      // -> getFirebaseStorageClient()
//   const ai     = useFirebaseAI();          // -> getFirebaseAIClient()
//
// In Server Components: import the bare getter. In Client Components ('use client'):
// wrap in a `use()` call + Suspense boundary per React 19 patterns.
// ============================================================================

/**
 * React 19 `cache()`-wrapped lazy getter for the browser FirebaseApp.
 * Returns `undefined` during SSR, on placeholder config, or when init failed.
 */
export const getFirebaseClientApp = cache((): FirebaseApp | undefined => {
  if (typeof window === 'undefined') return undefined
  if (app) return app
  if (getApps().length > 0) {
    app = getApps()[0]
    return app
  }
  return initializeFirebaseClient()
})

/**
 * React 19 `cache()`-wrapped lazy getter for the browser Firestore instance.
 */
export const getFirebaseFirestoreClient = cache((): Firestore | undefined => {
  if (typeof window === 'undefined') return undefined
  if (db) return db
  const a = getFirebaseClientApp()
  if (!a) return undefined
  if (isEmulatorEnabled() && !emulatorConnected) {
    try {
      const { connectFirestoreEmulator } = require('firebase/firestore')
      connectFirestoreEmulator(db!, 'localhost', 8080)
    } catch (err) {
      console.warn('[firebase-client] Firestore emulator connect failed', err)
    }
  }
  return db
})

/**
 * React 19 `cache()`-wrapped lazy getter for the browser Auth instance.
 */
export const getFirebaseAuthClient = cache((): Auth | undefined => {
  if (typeof window === 'undefined') return undefined
  if (auth) return auth
  const a = getFirebaseClientApp()
  if (!a) return undefined
  if (isEmulatorEnabled() && !emulatorConnected) {
    try {
      const { connectAuthEmulator } = require('firebase/auth')
      connectAuthEmulator(auth!, 'http://localhost:9099', { disableWarnings: true })
    } catch (err) {
      console.warn('[firebase-client] Auth emulator connect failed', err)
    }
  }
  return auth
})

/**
 * React 19 `cache()`-wrapped lazy getter for the browser Storage instance.
 * Lazy-imports `firebase/storage` so the SDK is only loaded when actually used.
 */
export const getFirebaseStorageClient = cache(async (): Promise<
  ReturnType<typeof import('firebase/storage').getStorage> | undefined
> => {
  if (typeof window === 'undefined') return undefined
  if (storage) return storage
  const a = getFirebaseClientApp()
  if (!a) return undefined
  try {
    const { getStorage } = await import('firebase/storage')
    storage = getStorage(a)
    if (isEmulatorEnabled() && !emulatorConnected) {
      try {
        const { connectStorageEmulator } = await import('firebase/storage')
        connectStorageEmulator(storage!, 'localhost', 9199)
      } catch (err) {
        console.warn('[firebase-client] Storage emulator connect failed', err)
      }
    }
    return storage
  } catch (err) {
    console.error('[firebase-client] Storage init failed', err)
    return undefined
  }
})

/**
 * React 19 `cache()`-wrapped lazy getter for Firebase AI Logic client
 * (Firebase AI Logic = `firebase/ai` SDK, supersedes Vertex AI in Firebase).
 * Lazy-imports `firebase/ai` so the SDK is only loaded when actually used.
 *
 * @see https://firebase.google.com/docs/ai-logic
 */
export const getFirebaseAIClient = cache(async (): Promise<
  ReturnType<typeof import('firebase/ai').getAI> | undefined
> => {
  if (typeof window === 'undefined') return undefined
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
})

/**
 * SSR-safe check: returns true when the client app is initialized and ready
 * for use. Pair with `useFirebaseApp()` (planned) in a `useEffect` or after
 * a `use()` Suspense boundary in React 19.
 */
export function isFirebaseClientReady(): boolean {
  if (typeof window === 'undefined') return false
  return getApps().length > 0 && !!app
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
  if (!storage) {
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
// Backward-compatible module-level exports (used by hooks/use-fcm.ts and
// other legacy client code). New code should prefer the React 19 native
// getters above: getFirebaseClientApp() / getFirebaseFirestoreClient() /
// getFirebaseAuthClient().
// ============================================================================

export { app, db, auth }
