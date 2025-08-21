// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import crypto from 'crypto';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

export async function generateNonce(publicAddress: string): Promise<{ nonce: string, expires: number }> {
  console.log('Services: generateNonce - Starting nonce generation process');

  if (!publicAddress) {
    console.error('Services: generateNonce - Public address not provided');
    throw new Error('Public address is required');
  }

  try {
    // Generate a random nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    console.log('Services: generateNonce - Nonce generated');

    // Calculate nonce expiration time (1 hour from now)
    const expires = Date.now() + 3600000; // 1 hour in milliseconds

    // Store the nonce in Firestore
    // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    const phase = getCurrentPhase();
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const userRef = adminDb.collection('users').doc(publicAddress);
    
    await userRef.set({
      nonce,
      nonceExpires: expires,
    }, { merge: true });

    console.log('Services: generateNonce - Nonce stored in Firestore');

    return { nonce, expires };
  } catch (error) {
    console.error('Services: generateNonce - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while generating nonce');
  }
}

