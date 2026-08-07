/**
 * Auth Adapter Singleton
 * Caches Auth.js adapters to prevent re-initialization and reduce logging noise
 * Ring-native: Uses DatabaseService for unified database operations
 */

import { FirestoreAdapter } from "@auth/firebase-adapter"
import { PostgreSQLAdapter } from "@/lib/auth/postgres-adapter"

// Cache for adapters
let cachedAdapter: any = null
let adapterType: 'postgresql' | 'firebase' | null = null

/**
 * Get cached Auth.js adapter synchronously (PostgreSQL path is sync; Firebase uses cached instance after first async init).
 */
export function getAuthAdapter(): import('next-auth/adapters').Adapter | null {
  const { shouldSkipDatabaseConnect } = require('./build-cache/phase-detector')
  if (shouldSkipDatabaseConnect()) {
    return null
  }

  // Check if we need to re-initialize (environment change)
  const { shouldUseFirebaseForDatabase } = require('./database/backend-mode-config')
  const useFirebase = shouldUseFirebaseForDatabase()
  const usePostgreSQL = !useFirebase

  const newAdapterType = usePostgreSQL ? 'postgresql' : useFirebase ? 'firebase' : null

  const logAdapterInit = (message: string) => {
    if (process.env.NODE_ENV === 'development' || process.env.RING_LOG_AUTH_ADAPTER === '1') {
      console.log(message)
    }
  }

  // Return cached adapter if available and type matches
  if (cachedAdapter && adapterType === newAdapterType) {
    return cachedAdapter
  }

  // Initialize new adapter
  if (usePostgreSQL) {
    try {
      cachedAdapter = PostgreSQLAdapter()
      adapterType = 'postgresql'
      logAdapterInit('🔧 Auth.js PostgreSQL adapter initialized (cached)')
    } catch (error) {
      console.error("Failed to initialize PostgreSQL adapter:", error)
      cachedAdapter = null
      adapterType = null
    }
  } else if (useFirebase) {
    try {
      // Sync path: Firebase Admin must be usable without awaiting DB bootstrap here (NextAuth init is sync).
      const { getAdminDb } = require("@/lib/firebase-admin.server") as typeof import("@/lib/firebase-admin.server")
      const adminDb = getAdminDb()
      if (adminDb) {
        cachedAdapter = FirestoreAdapter(adminDb)
        adapterType = 'firebase'
        logAdapterInit('🔧 Auth.js Firebase adapter initialized with DatabaseService (cached)')
      } else {
        console.error("Firebase admin database not available")
        cachedAdapter = null
        adapterType = null
      }
    } catch (error) {
      console.error("Failed to initialize Firestore adapter:", error)
      cachedAdapter = null
      adapterType = null
    }
  } else {
    console.warn('⚠️  No database adapter configured - running in JWT-only mode')
    cachedAdapter = null
    adapterType = null
  }

  return cachedAdapter
}

/**
 * Clear the cached adapter (useful for testing)
 */
export function clearAuthAdapterCache() {
  cachedAdapter = null
  adapterType = null
}
