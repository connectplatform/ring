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

/**
 * Validate Firebase configuration
 * @returns {boolean} True if all required fields are present
 */
function validateFirebaseConfig(): boolean {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId'];
  
  for (const field of requiredFields) {
    if (!clientCredentials[field as keyof typeof clientCredentials]) {
      // Use console.warn instead of console.error to reduce noise in development
      console.warn(`Firebase configuration missing: ${field}. Add NEXT_PUBLIC_FIREBASE_${field.toUpperCase()} to your .env.local file`);
      return false;
    }
  }
  
  return true;
}

/**
 * Get development Firebase configuration from .env.local
 * @returns {object} Development Firebase config
 */
function getDevFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_DEV_API_KEY || "demo-api-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_DEV_AUTH_DOMAIN || "demo-project.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID || "demo-project",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_DEV_STORAGE_BUCKET || "demo-project.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_DEV_MESSAGING_SENDER_ID || "123456789",
    appId: process.env.NEXT_PUBLIC_FIREBASE_DEV_APP_ID || "1:123456789:web:demo-app-id",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_DEV_MEASUREMENT_ID || "G-DEMO-ID"
  };
}

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
    try {
      // Check if we have valid configuration
      const config = validateFirebaseConfig() ? clientCredentials : getDevFirebaseConfig();
      
      if (!validateFirebaseConfig()) {
        console.warn('Using development Firebase configuration. Set environment variables for production.');
      }
      
      app = initializeApp(config);
      db = getFirestore(app);
      auth = getAuth(app);
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }
  return app;
}

// Initialize Firebase client when this module is imported
try {
  initializeFirebaseClient();
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

export { app, db, auth, validateFirebaseConfig };

