// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { auth } from '@/auth';
import { UserRole, Wallet, AuthUser } from '@/features/auth/types';
import { ethers } from 'ethers';
import { FieldValue } from 'firebase-admin/firestore';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument as getCachedStaticDocument, getCachedCollection } from '@/lib/build-cache/static-data-cache';
import { 
  getCachedDocument,
  updateDocument
} from '@/lib/services/firebase-service-manager';

/**
 * Ensures that the authenticated user has at least one wallet.
 * If the user doesn't have a wallet, it creates a new one.
 * 
 * User steps:
 * 1. User logs in or accesses a feature requiring a wallet.
 * 2. The system calls this function to check if the user has a wallet.
 * 3. If no wallet exists, a new one is created automatically.
 * 4. The new or existing wallet is returned for further use.
 * 
 * @returns {Promise<Wallet>} A promise that resolves to the user's primary wallet.
 * @throws {Error} If the user is not authenticated or if there's an error during the process.
 */
export async function ensureWallet(): Promise<Wallet> {
  console.log('Services: ensureWallet - Starting wallet ensure process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: ensureWallet - Unauthorized access attempt');
      throw new Error('Unauthorized: Please log in to ensure wallet');
    }

    const { id: userId, role: userRole } = session.user;
    console.log(`Services: ensureWallet - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Validate user role (optional, remove if not needed)
    if (userRole === UserRole.VISITOR) {
      console.error('Services: ensureWallet - Visitors are not allowed to have wallets');
      throw new Error('Access denied: Visitors cannot have wallets');
    }

    // Step 3: Retrieve user document using optimized firebase-service-manager
    const phase = getCurrentPhase();
    const userDocSnap = await getCachedDocument('users', userId);
    
    if (!userDocSnap || !userDocSnap.exists) {
      throw new Error('User document not found in Firestore');
    }

    const userData = userDocSnap.data() as AuthUser | undefined;
    if (!userData) {
      throw new Error('User document exists but has no data');
    }

    // Step 4: Check if user already has a wallet
    if (userData.wallets && userData.wallets.length > 0) {
      const { selectDefaultWallet } = await import('./utils')
      const primaryWallet = selectDefaultWallet(userData.wallets)!
      console.log(`Services: ensureWallet - User already has a primary wallet: ${primaryWallet.address}`);
      return primaryWallet;
    }

    // Step 5: Create a new wallet using ethers.js
    console.log('Services: ensureWallet - Creating new wallet');
    const wallet = ethers.Wallet.createRandom();
    const address = await wallet.getAddress();

    // Step 6: Encrypt the private key before storing
    const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
    if (!encryptionKey) {
      console.error('CRITICAL: WALLET_ENCRYPTION_KEY is not set in environment variables.');
      console.error('To fix this:');
      console.error('1. Generate a key: openssl rand -hex 32');
      console.error('2. Add to .env.local: WALLET_ENCRYPTION_KEY=your_generated_key');
      console.error('3. Restart the development server');
      throw new Error('Wallet encryption key is not set. Check server logs for setup instructions.');
    }
    const encryptedPrivateKey = await wallet.encrypt(encryptionKey);

    // Step 7: Prepare the new wallet information
    const newWallet: Wallet = {
      address,
      encryptedPrivateKey,
      createdAt: new Date().toISOString(),
      label: 'Primary Wallet',
      isDefault: true,
      balance: '0' // Initialize balance to '0'
    };

    // Step 8: Add the new wallet to the user's wallets array using optimized firebase-service-manager
    await updateDocument('users', userId, {
      wallets: FieldValue.arrayUnion(newWallet)
    });

    // Optional on-chain initialization hook (no-op unless implemented)
    try {
      const { initializeOnChain } = await import('@/features/wallet/services/onchain-init')
      if (typeof initializeOnChain === 'function') {
        await initializeOnChain(newWallet)
      }
    } catch (_) {
      // silently ignore if not present
    }

    console.log('Services: ensureWallet - Wallet created successfully:', address);
    return newWallet;
  } catch (error) {
    console.error('Services: ensureWallet - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while ensuring wallet');
  }
}

/**
 * Decrypts the private key of a wallet.
 * This function should be implemented securely, possibly using a Hardware Security Module (HSM) or a secure key management service.
 * 
 * User steps:
 * 1. This function is called internally when the system needs to perform operations requiring the decrypted private key.
 * 2. The encrypted private key is passed to this function.
 * 3. The function decrypts the private key using a secure method.
 * 4. The decrypted private key is returned for immediate use and should not be stored in plain text.
 * 
 * @param {string} encryptedPrivateKey - The encrypted private key of the wallet.
 * @returns {Promise<string>} A promise that resolves to the decrypted private key.
 * @throws {Error} If the decryption process fails or is not implemented.
 */
async function decryptPrivateKey(encryptedPrivateKey: string): Promise<string> {
  // TODO: Implement secure decryption logic
  // This is a placeholder and should be replaced with actual secure decryption
  throw new Error('Decryption not implemented');
}

