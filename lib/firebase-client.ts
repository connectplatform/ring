import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Firebase client configuration
 * These values should be set in your environment variables
 */
const clientCredentials = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

/**
 * Initializes the Firebase client app
 * 
 * User steps:
 * 1. Ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set
 * 2. Call this function in your client-side code before using Firebase services
 * 
 * @returns {FirebaseApp} The initialized Firebase app
 */
function initializeFirebaseClient(): FirebaseApp {
  if (typeof window !== 'undefined' && !getApps().length) {
    app = initializeApp(clientCredentials);
    db = getFirestore(app);
    auth = getAuth(app);
  }
  return app;
}

// Initialize Firebase client when this module is imported
initializeFirebaseClient();

export { app, db, auth };

