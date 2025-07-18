import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getDatabase, Database, Reference, ServerValue, OnDisconnect } from 'firebase-admin/database'; // Import OnDisconnect

/**
 * Global variables to hold Firebase Admin instances.
 */
let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;
let adminRtdb: Database;

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
  
  // Check if this is a build-time environment and skip if environment variables are missing
  if (!process.env.AUTH_FIREBASE_PROJECT_ID && (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV === 'production')) {
    throw new Error('Firebase configuration missing - this may be expected during build time');
  }
  
  if (!adminApp) {
    const apps = getApps();
    if (!apps.length) {
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

      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.AUTH_FIREBASE_PROJECT_ID,
          clientEmail: process.env.AUTH_FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.AUTH_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    } else {
      adminApp = apps[0];
    }
  }
  return adminApp;
}

/**
 * Returns the Firestore instance for the admin app.
 *
 * User steps:
 * 1. Call this function to get the Firestore instance.
 * 2. Use the returned instance for Firestore operations.
 *
 * @returns {Firestore} The Firestore instance.
 */
export function getAdminDb(): Firestore {
  if (typeof window === 'undefined' && !adminDb) {
    const app = getFirebaseAdminApp();
    adminDb = getFirestore(app);
  }
  return adminDb;
}

/**
 * Returns the Auth instance for the admin app.
 *
 * User steps:
 * 1. Call this function to get the Auth instance.
 * 2. Use the returned instance for Firebase Authentication operations.
 *
 * @returns {Auth} The Auth instance.
 */
export function getAdminAuth(): Auth {
  if (typeof window === 'undefined' && !adminAuth) {
    const app = getFirebaseAdminApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

/**
 * Returns the Realtime Database instance for the admin app.
 *
 * User steps:
 * 1. Call this function to get the Realtime Database instance.
 * 2. Use the returned instance for Realtime Database operations.
 *
 * @returns {Database} The Realtime Database instance.
 */
export function getAdminRtdb(): Database {
  if (typeof window === 'undefined' && !adminRtdb) {
    const app = getFirebaseAdminApp();
    adminRtdb = getDatabase(app);
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