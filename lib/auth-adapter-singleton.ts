/**
 * Auth Adapter Singleton
 * Caches Auth.js adapters to prevent re-initialization and reduce logging noise
 */

import { FirestoreAdapter } from "@auth/firebase-adapter"
import { PostgreSQLAdapter } from "@/lib/auth/postgres-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"

// Cache for adapters
let cachedAdapter: any = null
let adapterType: 'postgresql' | 'firebase' | null = null

/**
 * Get cached Auth.js adapter based on environment configuration
 * @returns Auth.js adapter instance
 */
export function getAuthAdapter() {
  // Check if we need to re-initialize (environment change)
  const { shouldUseFirebaseForDatabase } = require('./database/backend-mode-config')
  const useFirebase = shouldUseFirebaseForDatabase()
  const usePostgreSQL = !useFirebase

  const newAdapterType = usePostgreSQL ? 'postgresql' : useFirebase ? 'firebase' : null

  // Return cached adapter if available and type matches
  if (cachedAdapter && adapterType === newAdapterType) {
    return cachedAdapter
  }

  // Initialize new adapter
  if (usePostgreSQL) {
    try {
      cachedAdapter = PostgreSQLAdapter()
      adapterType = 'postgresql'
      console.log('🔧 Auth.js PostgreSQL adapter initialized (cached)')
    } catch (error) {
      console.error("Failed to initialize PostgreSQL adapter:", error)
      cachedAdapter = null
      adapterType = null
    }
  } else if (useFirebase) {
    try {
      const adminDb = getAdminDb()
      if (adminDb) {
        cachedAdapter = FirestoreAdapter(adminDb)
        adapterType = 'firebase'
        console.log('🔧 Auth.js Firebase adapter initialized (cached)')
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
