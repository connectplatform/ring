import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getDatabase, type Database, type Reference, ServerValue, type OnDisconnect } from 'firebase-admin/database';
import { isBuildTime, getMockFirebaseServices, logBuildOptimization } from './firebase/build-mock.server';

/**
 * Global variables to hold Firebase Admin instances with singleton optimization.
 */
let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;
let adminRtdb: Database;

/**
 * Global initialization flag to prevent multiple initialization logs
 * and track singleton state across all imports during build process
 */
declare global {
  var __FIREBASE_ADMIN_INITIALIZED: boolean | undefined;
  var __FIREBASE_ADMIN_BUILD_METRICS: { initCount: number; firstInit: number } | undefined;
}

// Initialize build metrics tracking
if (typeof global !== 'undefined' && !global.__FIREBASE_ADMIN_BUILD_METRICS) {
  global.__FIREBASE_ADMIN_BUILD_METRICS = {
    initCount: 0,
    firstInit: Date.now()
  };
}

/**
 * Initializes and returns the Firebase Admin app instance.
 *
 * User steps:
 * 1. Ensure environment variables are set (AUTH_FIREBASE_PROJECT_ID, AUTH_FIREBASE_CLIENT_EMAIL, AUTH_FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL).
 * 2. Call this function to get the Firebase Admin app instance.
 *
 * @returns {App} The Firebase Admin app instance.
 */
function getFirebaseAdminApp(): App {
  // Skip initialization during build time or if window is defined (client-side)
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK should not be initialized on client-side');
  }
  
  // TRUE SINGLETON: Return existing app immediately if available
  if (adminApp) {
    return adminApp;
  }
  
  // Check existing apps and reuse if available (prevents multiple Firebase instances)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }
  
  // Check if this is a build-time environment and skip if environment variables are missing
  if (!process.env.AUTH_FIREBASE_PROJECT_ID) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('Firebase configuration missing during build - this is expected');
      throw new Error('Firebase configuration missing during build');
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('Firebase configuration missing in production - check AUTH_FIREBASE_* environment variables');
    } else {
      console.warn('Firebase configuration missing in development - some features may not work');
      throw new Error('Firebase configuration missing');
    }
  }

  // Track initialization attempts for debugging
  if (global.__FIREBASE_ADMIN_BUILD_METRICS) {
    global.__FIREBASE_ADMIN_BUILD_METRICS.initCount++;
  }
  
  // Validate required environment variables
  if (!process.env.AUTH_FIREBASE_PROJECT_ID) {
    throw new Error('AUTH_FIREBASE_PROJECT_ID environment variable is required');
  }
  if (!process.env.AUTH_FIREBASE_CLIENT_EMAIL) {
    throw new Error('AUTH_FIREBASE_CLIENT_EMAIL environment variable is required');
  }
  if (!process.env.AUTH_FIREBASE_PRIVATE_KEY) {
    throw new Error('AUTH_FIREBASE_PRIVATE_KEY environment variable is required');
  }

  // Clean and validate project ID (remove any illegal characters like newlines and quotes)
  const projectId = process.env.AUTH_FIREBASE_PROJECT_ID
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\\n/g, '') // Remove escaped newlines
    .replace(/[\n\r]/g, '') // Remove actual newlines
    .trim();
  
  if (!projectId) {
    console.error('AUTH_FIREBASE_PROJECT_ID is empty after cleaning:', JSON.stringify(process.env.AUTH_FIREBASE_PROJECT_ID));
    throw new Error('AUTH_FIREBASE_PROJECT_ID is invalid. Please check your environment variable.');
  }

  // Clean and validate client email
  const clientEmail = process.env.AUTH_FIREBASE_CLIENT_EMAIL
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\\n/g, '') // Remove escaped newlines
    .replace(/[\n\r]/g, '') // Remove actual newlines
    .trim();
  
  if (!clientEmail.includes('@') || !clientEmail.includes('.')) {
    console.error('AUTH_FIREBASE_CLIENT_EMAIL is invalid:', JSON.stringify(process.env.AUTH_FIREBASE_CLIENT_EMAIL));
    throw new Error('AUTH_FIREBASE_CLIENT_EMAIL must be a valid email address');
  }

  // Clean and validate private key
  const privateKey = process.env.AUTH_FIREBASE_PRIVATE_KEY
    .replace(/^["']|["']$/g, '') // Remove surrounding quotes
    .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines
    .trim();
  
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    console.error('AUTH_FIREBASE_PRIVATE_KEY format is invalid');
    throw new Error('AUTH_FIREBASE_PRIVATE_KEY must be a valid private key in PEM format');
  }
  
  // OPTIMIZED LOGGING: Only log ONCE during entire build process using global flag
  if (!global.__FIREBASE_ADMIN_INITIALIZED) {
    if (process.env.NODE_ENV === 'production' || process.env.FIREBASE_DEBUG_LOGS === 'true') {
      console.log('Firebase Admin SDK initializing with project:', projectId);
      
      // Development metrics
      if (process.env.NODE_ENV === 'development' && global.__FIREBASE_ADMIN_BUILD_METRICS) {
        console.log(`Firebase initialization attempt #${global.__FIREBASE_ADMIN_BUILD_METRICS.initCount}`);
      }
    }
    global.__FIREBASE_ADMIN_INITIALIZED = true;
  }

  // Initialize Firebase Admin SDK
  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  
  return adminApp;
}

/**
 * Returns the Firestore instance for the admin app.
 * Optimized with lazy initialization, singleton pattern, and build-time mocking.
 *
 * User steps:
 * 1. Call this function to get the Firestore instance.
 * 2. Use the returned instance for Firestore operations.
 *
 * @returns {Firestore} The Firestore instance.
 */
export function getAdminDb(): Firestore {
  // BUILD-TIME OPTIMIZATION: Return mock service during Next.js build
  if (isBuildTime()) {
    logBuildOptimization('Using mock Firestore during build-time');
    const { mockDb } = getMockFirebaseServices();
    return mockDb;
  }
  
  // Early return if already initialized (TRUE SINGLETON)
  if (adminDb) {
    return adminDb;
  }
  
  if (typeof window === 'undefined') {
    const app = getFirebaseAdminApp();
    adminDb = getFirestore(app);
  } else {
    throw new Error('Firebase Admin Firestore should not be accessed on client-side');
  }
  
  return adminDb;
}

/**
 * Returns the Auth instance for the admin app.
 * Optimized with lazy initialization, singleton pattern, and build-time mocking.
 *
 * User steps:
 * 1. Call this function to get the Auth instance.
 * 2. Use the returned instance for Firebase Authentication operations.
 *
 * @returns {Auth} The Auth instance.
 */
export function getAdminAuth(): Auth {
  // BUILD-TIME OPTIMIZATION: Return mock service during Next.js build
  if (isBuildTime()) {
    logBuildOptimization('Using mock Auth during build-time');
    const { mockAuth } = getMockFirebaseServices();
    return mockAuth;
  }
  
  // Early return if already initialized (TRUE SINGLETON)
  if (adminAuth) {
    return adminAuth;
  }
  
  if (typeof window === 'undefined') {
    const app = getFirebaseAdminApp();
    adminAuth = getAuth(app);
  } else {
    throw new Error('Firebase Admin Auth should not be accessed on client-side');
  }
  
  return adminAuth;
}

/**
 * Returns the Realtime Database instance for the admin app.
 * Optimized with lazy initialization, singleton pattern, and build-time mocking.
 *
 * User steps:
 * 1. Call this function to get the Realtime Database instance.
 * 2. Use the returned instance for Realtime Database operations.
 *
 * @returns {Database} The Realtime Database instance.
 */
export function getAdminRtdb(): Database {
  // BUILD-TIME OPTIMIZATION: Return mock service during Next.js build
  if (isBuildTime()) {
    logBuildOptimization('Using mock Realtime Database during build-time');
    const { mockRtdb } = getMockFirebaseServices();
    return mockRtdb;
  }
  
  // Early return if already initialized (TRUE SINGLETON)
  if (adminRtdb) {
    return adminRtdb;
  }
  
  if (typeof window === 'undefined') {
    const app = getFirebaseAdminApp();
    adminRtdb = getDatabase(app);
  } else {
    throw new Error('Firebase Admin Realtime Database should not be accessed on client-side');
  }
  
  return adminRtdb;
}

/**
 * Returns a reference to a location in the Realtime Database.
 *
 * @param {string} path - The path to the desired location in the database.
 * @returns {Reference} A reference to the specified location.
 */
export function getAdminRtdbRef(path: string): Reference {
  const db = getAdminRtdb();
  return db.ref(path);
}

/**
 * Sets data at a specified location in the Realtime Database.
 *
 * @param {string} path - The path to the desired location in the database.
 * @param {any} data - The data to be set at the specified location.
 * @returns {Promise<void>} A promise that resolves when the data has been set.
 */
export function setAdminRtdbData(path: string, data: any): Promise<void> {
  const ref = getAdminRtdbRef(path);
  return ref.set(data);
}

/**
 * Sets up an onDisconnect operation for a specified location in the Realtime Database
 *
 * @param {string} path - The path to the desired location in the database
 * @returns {OnDisconnect} The OnDisconnect object for the specified location
 */
export function setAdminRtdbOnDisconnect(path: string): OnDisconnect { // Return OnDisconnect type
  const ref = getAdminRtdbRef(path);
  return ref.onDisconnect();
}

/**
 * Returns a server timestamp that can be used in Realtime Database operations.
 *
 * @returns {typeof ServerValue.TIMESTAMP} A server timestamp value.
 */
export function getAdminRtdbServerTimestamp(): typeof ServerValue.TIMESTAMP {
  return ServerValue.TIMESTAMP;
}

// Note: Firebase Admin is now initialized lazily when first used
// This prevents build-time initialization issues

/**
 * Exported Firestore instance for general use.
 * 
 * Note: This is now initialized lazily to prevent build-time issues.
 * Use getAdminDb() function instead for better error handling.
 *
 * @type {Firestore}
 */
export const adminFirestore = null; // Deprecated: Use getAdminDb() instead

export { adminAuth, adminRtdb };