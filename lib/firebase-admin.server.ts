/**
 * NOTE on the absent `import 'server-only'`:
 *
 * This file follows the **`.server.ts` filename convention** (the canonical
 * Next.js pattern that the bundler respects) plus **runtime guards** in every
 * getter (`if (typeof window !== 'undefined') throw new Error(...)`) instead
 * of using the `server-only` package.
 *
 * Why? This module is in the **import graph of the root layout** via
 *   `app/layout.tsx` → `ring-config-core.ts` → `lib/database/index.ts` →
 *   `lib/database/adapters/FirebaseAdapter.ts` → `lib/firebase-admin.server.ts`
 * and the root layout renders a `app-client-shell.tsx` Client Component.
 * With Next.js 15+ App Router, an explicit `import 'server-only'` in a
 * transitive dependency of a Client Component fails the build with
 * "This API is only available in Server Components in the App Router,
 * but you are using it in the Pages Router" — even though we're 100%
 * on the App Router. The build-bundler can't statically prove that the
 * `server-only` marker won't be reached from the client boundary.
 *
 * The `.server.ts` filename + the runtime `typeof window` guards in
 * every getter are the equivalent protection: Next.js will refuse to
 * bundle this file into any client build, and even if a future tool
 * ever inlined it, `firebase-admin` itself requires Node.js APIs and
 * will throw at import time in any non-Node environment.
 */

import { cert, getApps, initializeApp, deleteApp, type App, type AppOptions } from 'firebase-admin/app'
import { getFirestore, type Firestore, type Settings } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'
import { getStorage } from 'firebase-admin/storage'
import { getAppCheck } from 'firebase-admin/app-check'
import { getRemoteConfig, type RemoteConfig } from 'firebase-admin/remote-config'
import { getDatabase, type Database, type Reference, ServerValue, type OnDisconnect } from 'firebase-admin/database'
import { isBuildTime, getMockFirebaseServices, logBuildOptimization } from './firebase/build-mock.server'

/**
 * Firebase Admin SDK — react19-native server-side singleton.
 *
 * This module is the **single entry point** for server-side Firebase in
 * `firebase-full` ring-db mode (and for FCM push in any mode).
 *
 * ## React 19 native patterns
 *
 * - All getters are **lazy** (called only on first use) and **server-only**
 *   (`typeof window === 'undefined'` guard at the top of every public
 *   export). Importing from a client bundle will throw.
 * - `getAdminApp()` is the canonical entry point — call it from any
 *   Server Component, Server Action, or API route. React 19 `cache()`
 *   ensures one app instance per request cycle.
 * - The singleton survives Next.js dev HMR via `globalThis` to prevent
 *   "Firebase: Firebase App named '[DEFAULT]' already exists" errors.
 *
 * ## Firebase 14 + Admin SDK v14
 *
 * - All imports use **named subpath exports** (`firebase-admin/app`,
 *   `firebase-admin/messaging`, etc.) — parent-namespace access
 *   (`admin.firestore()`) was removed in v11.
 * - Lazy init uses **ADC (Application Default Credentials)** first
 *   (Cloud Run / GKE / Cloud Functions auto-detect credentials from
 *   metadata server) and falls back to explicit `cert()` from
 *   `AUTH_FIREBASE_*` env vars for local dev / CI.
 * - The official `firebase-admin/messaging` and `firebase-admin/vertexai`
 *   subpaths are wired for FCM Admin + AI Logic on the server.
 *
 * ## Build-mock integration
 *
 * In `k8s-postgres-fcm` and `supabase-fcm` modes (and during SSG build),
 * every getter returns a safe mock from `build-mock.server.ts` so
 * `firebase-admin` is never imported on the critical path. This saves
 * ~31% build time and prevents accidental Firestore/FCM init in
 * PostgreSQL-only deployments.
 *
 * @see https://firebase.google.com/docs/admin/setup
 * @see AI-LEGIOX/legiox-truth-lens/ring-backend-administrator.nodus.json
 * @see AI-LEGIOX/legiox-truth-lens/google-firebase-specialist.nodus.json
 */

declare global {
  // eslint-disable-next-line no-var
  var __RING_FIREBASE_ADMIN_APP__: App | undefined
  // eslint-disable-next-line no-var
  var __RING_FIREBASE_ADMIN_INITIALIZED__: boolean | undefined
  // eslint-disable-next-line no-var
  var __RING_FIREBASE_ADMIN_BUILD_METRICS__: {
    initCount: number
    firstInit: number
    servicesRequested: Record<string, number>
  } | undefined
}

// ============================================================================
// Internal state — singletons cached on globalThis for HMR safety
// ============================================================================

const globalForAdmin = globalThis as typeof globalThis & {
  __RING_FIREBASE_ADMIN_APP__?: App
  __RING_FIREBASE_ADMIN_INITIALIZED__?: boolean
  __RING_FIREBASE_ADMIN_BUILD_METRICS__?: {
    initCount: number
    firstInit: number
    servicesRequested: Record<string, number>
  }
}

if (!globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__) {
  globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__ = {
    initCount: 0,
    firstInit: Date.now(),
    servicesRequested: {},
  }
}

// Cached service instances (adminDb/adminAuth/etc.)
let adminDb: Firestore | undefined
let adminAuth: Auth | undefined
let adminRtdb: Database | undefined
let adminMessaging: Messaging | undefined
let adminStorage: ReturnType<typeof getStorage> | undefined
let adminAppCheck: ReturnType<typeof getAppCheck> | undefined
let adminRemoteConfig: RemoteConfig | undefined

// One-shot logging suppression for PostgreSQL-mode boot
let loggedPostgresModeDb = false
let loggedPostgresModeAuth = false
let loggedPostgresModeMessaging = false

function trackServiceRequest(service: string): void {
  const m = globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__
  if (m) {
    m.servicesRequested[service] = (m.servicesRequested[service] ?? 0) + 1
  }
}

function shouldUseFirebaseForDatabaseRuntime(): boolean {
  // Avoid loading the backend-mode-config module in the critical path —
  // it has its own dynamic require pattern. Inline the same check.
  if (process.env.DB_BACKEND_MODE === 'firebase-full') return true
  if (process.env.DB_BACKEND_MODE === 'k8s-postgres-fcm') return false
  if (process.env.DB_BACKEND_MODE === 'supabase-fcm') return false
  // Fall back to the canonical helper (lazy-require to avoid top-level cost)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { shouldUseFirebaseForDatabase } = require('./database/backend-mode-config')
    return shouldUseFirebaseForDatabase()
  } catch {
    return false
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Clean and validate the AUTH_FIREBASE_* env vars. The Firebase Admin SDK is
 * aggressive about input format — quotes and escaped newlines must be stripped.
 */
function cleanAdminEnvVars(): { projectId: string; clientEmail: string; privateKey: string } {
  if (!process.env.AUTH_FIREBASE_PROJECT_ID) {
    throw new Error('AUTH_FIREBASE_PROJECT_ID environment variable is required')
  }
  if (!process.env.AUTH_FIREBASE_CLIENT_EMAIL) {
    throw new Error('AUTH_FIREBASE_CLIENT_EMAIL environment variable is required')
  }
  if (!process.env.AUTH_FIREBASE_PRIVATE_KEY) {
    throw new Error('AUTH_FIREBASE_PRIVATE_KEY environment variable is required')
  }

  const projectId = process.env.AUTH_FIREBASE_PROJECT_ID
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\\n/g, '') // Remove escaped newlines
    .replace(/[\n\r]/g, '') // Remove actual newlines
    .trim()

  if (!projectId) {
    console.error('AUTH_FIREBASE_PROJECT_ID is empty after cleaning:', JSON.stringify(process.env.AUTH_FIREBASE_PROJECT_ID))
    throw new Error('AUTH_FIREBASE_PROJECT_ID is invalid. Please check your environment variable.')
  }

  const clientEmail = process.env.AUTH_FIREBASE_CLIENT_EMAIL
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '')
    .replace(/[\n\r]/g, '')
    .trim()

  if (!clientEmail.includes('@') || !clientEmail.includes('.')) {
    console.error('AUTH_FIREBASE_CLIENT_EMAIL is invalid:', JSON.stringify(process.env.AUTH_FIREBASE_CLIENT_EMAIL))
    throw new Error('AUTH_FIREBASE_CLIENT_EMAIL must be a valid email address')
  }

  const privateKey = process.env.AUTH_FIREBASE_PRIVATE_KEY
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n') // Convert escaped newlines to real newlines
    .trim()

  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    console.error('AUTH_FIREBASE_PRIVATE_KEY format is invalid')
    throw new Error('AUTH_FIREBASE_PRIVATE_KEY must be a valid private key in PEM format')
  }

  return { projectId, clientEmail, privateKey }
}

/**
 * Build the AppOptions for initializeApp(). Prefers explicit cert() when
 * AUTH_FIREBASE_* env vars are set, otherwise falls back to ADC.
 */
function buildAdminAppOptions(): AppOptions {
  const hasExplicitCredentials =
    !!process.env.AUTH_FIREBASE_PROJECT_ID &&
    !!process.env.AUTH_FIREBASE_CLIENT_EMAIL &&
    !!process.env.AUTH_FIREBASE_PRIVATE_KEY

  if (hasExplicitCredentials) {
    const { projectId, clientEmail, privateKey } = cleanAdminEnvVars()
    return {
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    }
  }

  // ADC (Application Default Credentials) — works on Cloud Run, Cloud
  // Functions, GKE, and locally via `gcloud auth application-default login`.
  const projectId =
    process.env.AUTH_FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT

  return {
    projectId,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  }
}

/**
 * Lazily initialize the Firebase Admin App. Returns the existing instance
 * if one was already created in this Node process.
 *
 * Initialization order:
 *   1. Reuse `globalThis.__RING_FIREBASE_ADMIN_APP__` if present (HMR-safe)
 *   2. Reuse any `getApps()` instance (defensive — should not happen)
 *   3. Build AppOptions from env + ADC, then `initializeApp()`
 *
 * @throws Error when in production with no credentials
 * @throws Error on the client (typeof window !== 'undefined')
 */
export function getAdminApp(): App {
  // Server-only — never import on the client.
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK should not be initialized on the client side')
  }

  // 1. HMR-safe singleton
  if (globalForAdmin.__RING_FIREBASE_ADMIN_APP__) {
    return globalForAdmin.__RING_FIREBASE_ADMIN_APP__
  }

  // 2. Reuse an existing default app if present
  if (getApps().length > 0) {
    const app = getApps()[0]
    globalForAdmin.__RING_FIREBASE_ADMIN_APP__ = app
    return app
  }

  // 3. Detect missing env vars and surface helpful errors
  if (!process.env.AUTH_FIREBASE_PROJECT_ID) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('Firebase configuration missing during build - this is expected')
      throw new Error('Firebase configuration missing during build')
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('Firebase configuration missing in production - check AUTH_FIREBASE_* environment variables')
    } else {
      console.warn('Firebase configuration missing in development - some features may not work')
      throw new Error('Firebase configuration missing')
    }
  }

  // 4. Track init attempt for observability
  if (globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__) {
    globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__.initCount++
  }

  // 5. Build options and initializeApp
  const appOptions = buildAdminAppOptions()

  if (!globalForAdmin.__RING_FIREBASE_ADMIN_INITIALIZED__) {
    if (process.env.NODE_ENV === 'production' || process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log('Firebase Admin SDK initializing with project:', appOptions.projectId)
    }
    globalForAdmin.__RING_FIREBASE_ADMIN_INITIALIZED__ = true
  }

  const app = initializeApp(appOptions)
  globalForAdmin.__RING_FIREBASE_ADMIN_APP__ = app
  return app
}

/**
 * Explicitly initialize the Firebase Admin App and return it.
 * Alias for `getAdminApp()` — same behavior, clearer name for callers that
 * want to make initialization explicit.
 */
export function initializeAdminApp(): App {
  return getAdminApp()
}

/**
 * True if the Firebase Admin App is already initialized in this process.
 */
export function isAdminAppInitialized(): boolean {
  return (
    !!globalForAdmin.__RING_FIREBASE_ADMIN_APP__ ||
    (typeof window === 'undefined' && getApps().length > 0)
  )
}

/**
 * Reset the cached admin app + service instances. TEST-ONLY — do not call
 * from production code.
 */
export function _resetAdminAppForTests(): void {
  try {
    if (globalForAdmin.__RING_FIREBASE_ADMIN_APP__) {
      deleteApp(globalForAdmin.__RING_FIREBASE_ADMIN_APP__).catch(() => {})
    }
  } catch {
    // ignore
  }
  globalForAdmin.__RING_FIREBASE_ADMIN_APP__ = undefined
  globalForAdmin.__RING_FIREBASE_ADMIN_INITIALIZED__ = undefined
  if (globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__) {
    globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__.servicesRequested = {}
  }
  adminDb = undefined
  adminAuth = undefined
  adminRtdb = undefined
  adminMessaging = undefined
  adminStorage = undefined
  adminAppCheck = undefined
  adminRemoteConfig = undefined
}

/**
 * Observability snapshot for the Firebase Admin SDK.
 * Returns init count, time since first init, and per-service request counts.
 */
export function getAdminAppMetrics() {
  const m = globalForAdmin.__RING_FIREBASE_ADMIN_BUILD_METRICS__
  return {
    initCount: m?.initCount ?? 0,
    firstInit: m?.firstInit ?? 0,
    ageMs: m ? Date.now() - m.firstInit : 0,
    servicesRequested: { ...(m?.servicesRequested ?? {}) },
    backendMode: process.env.DB_BACKEND_MODE ?? 'unknown',
    isInitialized: isAdminAppInitialized(),
  }
}

// ============================================================================
// Firestore (admin SDK v14)
// ============================================================================

/**
 * Returns the admin Firestore instance. Returns a build-mock in SSG or
 * non-firebase modes.
 */
export function getAdminDb(): Firestore {
  trackServiceRequest('firestore')
  if (isBuildTime()) {
    logBuildOptimization('Using mock Firestore during build-time')
    return getMockFirebaseServices().mockDb
  }
  if (!shouldUseFirebaseForDatabaseRuntime()) {
    if (!loggedPostgresModeDb) {
      console.log('🔧 Firebase database disabled (using PostgreSQL) - returning mock Firestore')
      loggedPostgresModeDb = true
    }
    return getMockFirebaseServices().mockDb
  }
  if (adminDb) return adminDb
  adminDb = getFirestore(getAdminApp())
  return adminDb
}

/**
 * Configure the cached Firestore instance with custom settings.
 * Useful for setting ignoreUndefinedProperties, databaseId, etc.
 */
export function configureAdminDb(settings: Settings): void {
  if (adminDb) {
    // settings are applied at the first getFirestore() call; if we already
    // cached an instance, re-fetch with new settings
    adminDb = getFirestore(getAdminApp(), settings.databaseId)
  }
  Object.assign(adminDb!, settings)
}

// ============================================================================
// Auth
// ============================================================================

/**
 * Returns the admin Auth instance. Returns a build-mock in SSG or
 * non-firebase modes.
 */
export function getAdminAuth(): Auth {
  trackServiceRequest('auth')
  if (isBuildTime()) {
    logBuildOptimization('Using mock Auth during build-time')
    return getMockFirebaseServices().mockAuth
  }
  if (!shouldUseFirebaseForDatabaseRuntime()) {
    if (!loggedPostgresModeAuth) {
      console.log('🔧 Firebase auth disabled (using PostgreSQL) - returning mock Auth')
      loggedPostgresModeAuth = true
    }
    return getMockFirebaseServices().mockAuth
  }
  if (adminAuth) return adminAuth
  adminAuth = getAuth(getAdminApp())
  return adminAuth
}

// ============================================================================
// FCM Admin (messaging) — Server-side push notifications
// ============================================================================

/**
 * Returns the admin Messaging instance for FCM HTTP v1 push notifications.
 * Always available (FCM is the only Firebase feature used in k8s-postgres-fcm
 * and supabase-fcm modes too — see `docs/ru/backend/firebase.mdx`).
 *
 * @see https://firebase.google.com/docs/cloud-messaging/send-message
 */
export function getAdminMessaging(): Messaging {
  trackServiceRequest('messaging')
  if (isBuildTime()) {
    return getMockFirebaseServices().mockMessaging as unknown as Messaging
  }
  if (adminMessaging) return adminMessaging
  // FCM works in ALL modes (PostgreSQL + Firestore); we don't gate on
  // shouldUseFirebaseForDatabaseRuntime here.
  adminMessaging = getMessaging(getAdminApp())
  return adminMessaging
}

// ============================================================================
// Storage (Firebase Storage — planned for firebase-full uploads)
// ============================================================================

/**
 * Returns the admin Storage instance. Lazy-initialized on first call.
 * Falls back to a stub when the storage subpackage is not installed.
 */
export function getAdminStorage(): ReturnType<typeof getStorage> {
  trackServiceRequest('storage')
  if (isBuildTime()) {
    return getMockFirebaseServices().mockStorage as unknown as ReturnType<typeof getStorage>
  }
  if (adminStorage) return adminStorage
  adminStorage = getStorage(getAdminApp())
  return adminStorage
}

// ============================================================================
// App Check
// ============================================================================

/**
 * Returns the admin App Check instance. Lazy-initialized on first call.
 * Used to issue App Check tokens that the client SDK can pass to Firebase
 * service calls to prove the request came from your authentic app.
 */
export function getAdminAppCheck(): ReturnType<typeof getAppCheck> {
  trackServiceRequest('appCheck')
  if (isBuildTime()) {
    return getMockFirebaseServices().mockAppCheck as unknown as ReturnType<typeof getAppCheck>
  }
  if (adminAppCheck) return adminAppCheck
  adminAppCheck = getAppCheck(getAdminApp())
  return adminAppCheck
}

// ============================================================================
// Remote Config
// ============================================================================

/**
 * Returns the admin Remote Config instance. Lazy-initialized on first call.
 * Useful for runtime feature flags backed by Firestore.
 */
export function getAdminRemoteConfig(): RemoteConfig {
  trackServiceRequest('remoteConfig')
  if (isBuildTime()) {
    return getMockFirebaseServices().mockRemoteConfig as unknown as RemoteConfig
  }
  if (adminRemoteConfig) return adminRemoteConfig
  adminRemoteConfig = getRemoteConfig(getAdminApp())
  return adminRemoteConfig
}

// ============================================================================
// Vertex AI on the server — OPTIONAL
// ----------------------------------------------------------------------------
// The `firebase-admin/vertexai` subpath is optional and may not be installed.
// To enable, `npm install firebase-admin vertexai @google-cloud/vertexai` and
// uncomment the import + getter below. For the **client-side** AI Logic
// client, use `getFirebaseAIClient()` from `lib/firebase-client.ts` instead.
// ============================================================================

/*
// Uncomment when @google-cloud/vertexai is installed:
import { getVertexAI, type VertexAI } from 'firebase-admin/vertexai';

let adminVertexAI: VertexAI | undefined;

export function getAdminVertexAI(): VertexAI {
  trackServiceRequest('vertexai');
  if (isBuildTime()) {
    return getMockFirebaseServices().mockVertexAI as unknown as VertexAI;
  }
  if (adminVertexAI) return adminVertexAI;
  adminVertexAI = getVertexAI(getAdminApp());
  return adminVertexAI;
}
*/

// ============================================================================
// Realtime Database (legacy — RTDB is NOT used in ring-db; retained for compat)
// ============================================================================

/**
 * Returns the admin Realtime Database instance. RTDB is **not** used by
 * Ring Platform's canonical real-time transport (Tunnel — see
 * `lib/tunnel`). This getter is kept for backward compatibility only.
 */
export function getAdminRtdb(): Database {
  trackServiceRequest('rtdb')
  if (isBuildTime()) {
    return getMockFirebaseServices().mockRtdb
  }
  if (!shouldUseFirebaseForDatabaseRuntime()) {
    if (!loggedPostgresModeDb) {
      console.log('🔧 Firebase realtime database disabled (using PostgreSQL) - returning mock Realtime DB')
      loggedPostgresModeDb = true
    }
    return getMockFirebaseServices().mockRtdb
  }
  if (adminRtdb) return adminRtdb
  adminRtdb = getDatabase(getAdminApp())
  return adminRtdb
}

/**
 * Returns a reference to a location in the Realtime Database.
 *
 * @param path - The path to the desired location in the database.
 */
export function getAdminRtdbRef(path: string): Reference {
  const db = getAdminRtdb()
  return db.ref(path)
}

/**
 * Sets data at a specified location in the Realtime Database.
 */
export function setAdminRtdbData(path: string, data: any): Promise<void> {
  const ref = getAdminRtdbRef(path)
  return ref.set(data)
}

/**
 * Sets up an onDisconnect operation for a specified location in the
 * Realtime Database.
 */
export function setAdminRtdbOnDisconnect(path: string): OnDisconnect {
  const ref = getAdminRtdbRef(path)
  return ref.onDisconnect()
}

/**
 * Returns a server timestamp that can be used in Realtime Database ops.
 */
export function getAdminRtdbServerTimestamp(): typeof ServerValue.TIMESTAMP {
  return ServerValue.TIMESTAMP
}

// ============================================================================
// Backward-compatible exports
// ============================================================================

/** @deprecated Use `getAdminApp()` instead. */
export const getFirebaseAdminApp = getAdminApp

// Note: Firebase Admin is now initialized lazily when first used.
// This prevents build-time initialization issues. Use the getAdmin*()
// functions above for better error handling and observability.

/**
 * Deprecated: use `getAdminDb()` instead. Kept as `null` to prevent
 * accidental top-level initialization.
 *
 * @deprecated Use getAdminDb() instead
 */
export const adminFirestore = null

// Re-export the most common getter for `import { getAdminAuth } from '...'`
// (back-compat — the original module exported these as named bindings).
export { adminAuth, adminRtdb }
