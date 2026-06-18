/**
 * Firebase Configuration Injection Script
 * Injects Firebase environment variables into the service worker at build time
 * This is necessary because service workers cannot access process.env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Firebase environment variables
const firebaseConfig = {
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Map to actual environment variable names for error reporting
const envVarNames = {
  FIREBASE_API_KEY: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  FIREBASE_AUTH_DOMAIN: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  FIREBASE_PROJECT_ID: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  FIREBASE_STORAGE_BUCKET: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  FIREBASE_MESSAGING_SENDER_ID: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  FIREBASE_APP_ID: 'NEXT_PUBLIC_FIREBASE_APP_ID',
  FIREBASE_MEASUREMENT_ID: 'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
};

function injectFirebaseConfig() {
  try {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');

    // Check if service worker file exists
    if (!fs.existsSync(swPath)) {
      console.error('❌ Service worker file not found:', swPath);
      return false;
    }

    // Read the service worker file
    let swContent = fs.readFileSync(swPath, 'utf8');

    // Check if we're in hybrid mode (DB_HYBRID_MODE=true)
    const isHybridMode = process.env.DB_HYBRID_MODE === 'true';

    // Check for missing environment variables
    const missingVars = Object.entries(firebaseConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => envVarNames[key]);

    if (missingVars.length > 0) {
      if (isHybridMode) {
        console.warn('⚠️  Hybrid mode detected - Firebase config will be injected at runtime via Kubernetes secrets');
        console.warn('⚠️  Service worker will use fallback values for build-time compatibility');
      } else {
        console.warn('⚠️  Missing Firebase environment variables:', missingVars.join(', '));
        console.warn('⚠️  Service worker will use fallback values');
      }
    }

    // Inject Firebase configuration into service worker
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      if (value) {
        // Find and replace the self.VARIABLE pattern
        const pattern = new RegExp(`self\\.${key}\\s*\\|\\|\\s*"[^"]*"`, 'g');
        const replacement = `"${value}"`;
        
        if (swContent.includes(`self.${key}`)) {
          swContent = swContent.replace(pattern, replacement);
          console.log(`✅ Injected ${key}`);
        }
      }
    });

    // Alternative: Replace the entire firebaseConfig object
    const configObjectPattern = /const firebaseConfig = \{[\s\S]*?\}/;
    const configReplacement = `const firebaseConfig = {
  apiKey: "${firebaseConfig.FIREBASE_API_KEY || 'your-api-key'}",
  authDomain: "${firebaseConfig.FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com'}",
  projectId: "${firebaseConfig.FIREBASE_PROJECT_ID || 'your-project-id'}",
  storageBucket: "${firebaseConfig.FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com'}",
  messagingSenderId: "${firebaseConfig.FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id'}",
  appId: "${firebaseConfig.FIREBASE_APP_ID || 'your-app-id'}",
  measurementId: "${firebaseConfig.FIREBASE_MEASUREMENT_ID || 'G-XXXXXXXXXX'}"
}`;

    if (configObjectPattern.test(swContent)) {
      swContent = swContent.replace(configObjectPattern, configReplacement);
      console.log('✅ Updated Firebase config object');
    }

    // buildConfig fallback inside getFirebaseConfig() (SW cannot read process.env)
    const buildConfigPattern = /const buildConfig = \{[\s\S]*?\};/;
    const buildConfigReplacement = `const buildConfig = {
    apiKey: "${firebaseConfig.FIREBASE_API_KEY || 'your-api-key'}",
    authDomain: "${firebaseConfig.FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com'}",
    projectId: "${firebaseConfig.FIREBASE_PROJECT_ID || 'your-project-id'}",
    storageBucket: "${firebaseConfig.FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com'}",
    messagingSenderId: "${firebaseConfig.FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id'}",
    appId: "${firebaseConfig.FIREBASE_APP_ID || 'your-app-id'}",
    measurementId: "${firebaseConfig.FIREBASE_MEASUREMENT_ID || 'G-XXXXXXXXXX'}"
  };`;

    if (buildConfigPattern.test(swContent)) {
      swContent = swContent.replace(buildConfigPattern, buildConfigReplacement);
      console.log('✅ Updated buildConfig fallback');
    }

    // Ensure self.FIREBASE_* defaults exist before getFirebaseConfig()
    const selfDefaults = Object.entries(firebaseConfig)
      .filter(([, value]) => value)
      .map(([key, value]) => `self.${key} = self.${key} || "${value}";`)
      .join('\n');
    if (selfDefaults && !swContent.includes('self.FIREBASE_API_KEY = self.FIREBASE_API_KEY')) {
      swContent = swContent.replace(
        'const getFirebaseConfig = () => {',
        `// Injected from .env.local at config:firebase time\n${selfDefaults}\n\nconst getFirebaseConfig = () => {`,
      );
      console.log('✅ Added self.FIREBASE_* defaults');
    }

    // Write the updated service worker
    fs.writeFileSync(swPath, swContent, 'utf8');
    
    console.log('🚀 Firebase configuration injected successfully!');
    
    // Validation
    const updatedContent = fs.readFileSync(swPath, 'utf8');
    const hasPlaceholders = updatedContent.includes('your-api-key') || 
                           updatedContent.includes('your-project-id');
    
    if (hasPlaceholders && Object.values(firebaseConfig).some(v => v)) {
      console.warn('⚠️  Warning: Service worker still contains placeholder values');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error injecting Firebase configuration:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔧 Injecting Firebase configuration into service worker...');
  const success = injectFirebaseConfig();
  process.exit(success ? 0 : 1);
}

export { injectFirebaseConfig }; 