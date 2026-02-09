/**
 * Ring Platform Backend Mode Configuration
 * 
 * Modern multi-backend architecture with DB_BACKEND_MODE
 * Supports three sophisticated deployment strategies:
 * - k8s-postgres-fcm: PostgreSQL on Kubernetes + Firebase FCM + Apple Push
 * - firebase-full: Complete Firebase stack for all operations
 * - supabase-fcm: Supabase PostgreSQL + Firebase FCM + Apple Push
 * 
 * Created: 2025-10-23
 * Author: Ring Backend Administrator (Legion Agent)
 */

import { DatabaseBackendConfig, DatabaseSyncConfig } from './interfaces/IDatabaseService'

/**
 * Supported Backend Modes
 */
export type BackendMode = 'k8s-postgres-fcm' | 'firebase-full' | 'supabase-fcm'

/**
 * Backend Mode Configuration Interface
 */
export interface BackendModeConfig {
  mode: BackendMode
  description: string
  backends: DatabaseBackendConfig[]
  pushNotifications: {
    fcm: boolean
    apple: boolean
  }
  sync: DatabaseSyncConfig
}

/**
 * Detect Backend Mode from Environment Variables
 * DB_BACKEND_MODE is REQUIRED - no defaults, no backward compatibility
 */
export function detectBackendMode(): BackendMode {
  const backendMode = process.env.DB_BACKEND_MODE as BackendMode | undefined

  if (!backendMode) {
    console.error('❌ DB_BACKEND_MODE environment variable is REQUIRED')
    console.error('   Valid modes: k8s-postgres-fcm, firebase-full, supabase-fcm')
    console.error('   Example: DB_BACKEND_MODE=k8s-postgres-fcm')
    console.error('   Documentation: https://ring-platform.org/docs/deployment/backend-modes')
    throw new Error('DB_BACKEND_MODE environment variable is required')
  }

  // Validate the backend mode
  const validModes: BackendMode[] = ['k8s-postgres-fcm', 'firebase-full', 'supabase-fcm']
  
  if (!validModes.includes(backendMode)) {
    console.error(`❌ Invalid DB_BACKEND_MODE: ${backendMode}`)
    console.error(`   Valid modes: ${validModes.join(', ')}`)
    throw new Error(`Invalid DB_BACKEND_MODE: ${backendMode}. Must be one of: ${validModes.join(', ')}`)
  }

  return backendMode
}

/**
 * Get Backend Configuration for Kubernetes PostgreSQL + FCM Mode
 */
function getK8sPostgresFCMConfig(): BackendModeConfig {
  return {
    mode: 'k8s-postgres-fcm',
    description: 'Production Kubernetes deployment with PostgreSQL database and Firebase FCM',
    backends: [
      {
        type: 'postgresql',
        connection: {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'ring_platform',
          username: process.env.DB_USER || 'ring_user',
          password: process.env.DB_PASSWORD || 'ring_dev_password'
        },
        options: {
          poolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
          timeout: parseInt(process.env.DB_TIMEOUT || '30000'),
          retries: parseInt(process.env.DB_RETRIES || '3'),
          ssl: process.env.DB_SSL === 'true'
        }
      }
      // Note: Firebase is NOT registered as a backend in this mode
      // Firebase Admin SDK is still initialized separately for FCM push notifications only
    ],
    pushNotifications: {
      fcm: true,  // Firebase Cloud Messaging enabled
      apple: true // Apple Push Notification Service enabled
    },
    sync: {
      enabled: false, // No sync needed - single backend
      backends: ['postgresql'],
      strategy: 'master-slave',
      conflictResolution: 'latest-wins',
      syncInterval: 300000,
      batchSize: 100
    }
  }
}

/**
 * Get Backend Configuration for Firebase Full Mode
 */
function getFirebaseFullConfig(): BackendModeConfig {
  return {
    mode: 'firebase-full',
    description: 'Complete Firebase integration for rapid development and Vercel Edge deployments',
    backends: [
      {
        type: 'firebase',
        connection: {
          projectId: process.env.AUTH_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          credentials: {
            type: 'service_account',
            project_id: process.env.AUTH_FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.AUTH_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.AUTH_FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
          }
        },
        options: {
          timeout: 30000,
          retries: 3
        }
      }
    ],
    pushNotifications: {
      fcm: true,  // Firebase Cloud Messaging enabled
      apple: true // Apple Push via Firebase enabled
    },
    sync: {
      enabled: false, // No sync needed - single backend
      backends: ['firebase'],
      strategy: 'master-slave',
      conflictResolution: 'latest-wins',
      syncInterval: 300000,
      batchSize: 100
    }
  }
}

/**
 * Get Backend Configuration for Supabase + FCM Mode
 */
function getSupabaseFCMConfig(): BackendModeConfig {
  return {
    mode: 'supabase-fcm',
    description: 'Supabase PostgreSQL with Firebase FCM for cloud-hosted deployments',
    backends: [
      {
        type: 'postgresql', // Supabase uses PostgreSQL protocol
        connection: {
          // Supabase connection string format
          host: process.env.SUPABASE_DB_HOST || extractHostFromSupabaseUrl(),
          port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
          database: process.env.SUPABASE_DB_NAME || 'postgres',
          username: process.env.SUPABASE_DB_USER || 'postgres',
          password: process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_KEY || ''
        },
        options: {
          poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
          timeout: parseInt(process.env.DB_TIMEOUT || '30000'),
          retries: parseInt(process.env.DB_RETRIES || '3'),
          ssl: true // Supabase requires SSL
        }
      }
      // Note: Firebase is NOT registered as a backend in this mode
      // Firebase Admin SDK is still initialized separately for FCM push notifications only
    ],
    pushNotifications: {
      fcm: true,  // Firebase Cloud Messaging enabled
      apple: true // Apple Push Notification Service enabled
    },
    sync: {
      enabled: false, // No sync needed - single backend
      backends: ['postgresql'],
      strategy: 'master-slave',
      conflictResolution: 'latest-wins',
      syncInterval: 300000,
      batchSize: 100
    }
  }
}

/**
 * Extract host from Supabase URL
 * Example: https://abcdefghij.supabase.co → abcdefghij.supabase.co
 */
function extractHostFromSupabaseUrl(): string {
  const supabaseUrl = process.env.SUPABASE_URL
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      return url.hostname
    } catch (error) {
      console.error('Failed to parse SUPABASE_URL:', error)
    }
  }
  return 'localhost'
}

/**
 * Get Backend Mode Configuration
 */
export function getBackendModeConfig(): BackendModeConfig {
  const mode = detectBackendMode()

  switch (mode) {
    case 'k8s-postgres-fcm':
      return getK8sPostgresFCMConfig()
    
    case 'firebase-full':
      return getFirebaseFullConfig()
    
    case 'supabase-fcm':
      return getSupabaseFCMConfig()
    
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = mode
      throw new Error(`Unsupported backend mode: ${_exhaustive}`)
  }
}

/**
 * Check if Firebase should be initialized for FCM
 * Returns true for all modes that use Firebase FCM
 */
export function shouldInitializeFirebaseFCM(): boolean {
  const mode = detectBackendMode()
  const config = getBackendModeConfig()
  return config.pushNotifications.fcm
}

/**
 * Check if Apple Push should be initialized
 * Returns true for modes that support Apple Push
 */
export function shouldInitializeApplePush(): boolean {
  const mode = detectBackendMode()
  const config = getBackendModeConfig()
  return config.pushNotifications.apple
}

/**
 * Check if Firebase should be used for database operations
 * Returns true only for firebase-full mode
 */
export function shouldUseFirebaseForDatabase(): boolean {
  const mode = detectBackendMode()
  return mode === 'firebase-full'
}

/**
 * Get current backend mode (for logging/debugging)
 */
export function getCurrentBackendMode(): BackendMode {
  return detectBackendMode()
}

/**
 * Validate Backend Mode Configuration
 * Checks that required environment variables are present
 */
export function validateBackendModeConfig(): { valid: boolean; errors: string[] } {
  const mode = detectBackendMode()
  const errors: string[] = []

  switch (mode) {
    case 'k8s-postgres-fcm':
      // PostgreSQL validation
      if (!process.env.DB_HOST) errors.push('DB_HOST is required for k8s-postgres-fcm mode')
      if (!process.env.DB_NAME) errors.push('DB_NAME is required for k8s-postgres-fcm mode')
      if (!process.env.DB_USER) errors.push('DB_USER is required for k8s-postgres-fcm mode')
      if (!process.env.DB_PASSWORD) errors.push('DB_PASSWORD is required for k8s-postgres-fcm mode')
      
      // FCM validation (optional but recommended)
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn('⚠️  NEXT_PUBLIC_FIREBASE_PROJECT_ID not set - FCM push notifications disabled')
      }
      break

    case 'firebase-full':
      // Firebase validation
      if (!process.env.AUTH_FIREBASE_PROJECT_ID) {
        errors.push('AUTH_FIREBASE_PROJECT_ID is required for firebase-full mode')
      }
      if (!process.env.AUTH_FIREBASE_PRIVATE_KEY) {
        errors.push('AUTH_FIREBASE_PRIVATE_KEY is required for firebase-full mode')
      }
      if (!process.env.AUTH_FIREBASE_CLIENT_EMAIL) {
        errors.push('AUTH_FIREBASE_CLIENT_EMAIL is required for firebase-full mode')
      }
      break

    case 'supabase-fcm':
      // Supabase validation
      if (!process.env.SUPABASE_URL) errors.push('SUPABASE_URL is required for supabase-fcm mode')
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_DB_PASSWORD) {
        errors.push('SUPABASE_SERVICE_KEY or SUPABASE_DB_PASSWORD is required for supabase-fcm mode')
      }
      
      // FCM validation (optional but recommended)
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn('⚠️  NEXT_PUBLIC_FIREBASE_PROJECT_ID not set - FCM push notifications disabled')
      }
      break
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

