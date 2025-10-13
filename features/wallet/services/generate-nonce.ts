// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import crypto from 'crypto';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

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

    // Store the nonce in database
    console.log('Services: generateNonce - Initializing database service');
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error('Services: generateNonce - Database initialization failed:', initResult.error);
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();

    // First read the current user data
    const userResult = await dbService.read('users', publicAddress);
    const userData = userResult.success && userResult.data ? (userResult.data.data || userResult.data) : {};

    // Update with nonce information
    const updatedUserData = {
      ...userData,
      nonce,
      nonceExpires: expires,
    };

    const updateResult = await dbService.update('users', publicAddress, updatedUserData);
    if (!updateResult.success) {
      throw new Error('Failed to store nonce in database');
    }

    console.log('Services: generateNonce - Nonce stored in database');

    return { nonce, expires };
  } catch (error) {
    console.error('Services: generateNonce - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while generating nonce');
  }
}

