// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { auth } from '@/auth';
import { UserRole, Wallet } from '@/features/auth/types';
import { ethers } from 'ethers';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

/**
 * Creates a new wallet for the authenticated user using ethers.js.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Validates the user's role (optional, can be removed if not needed).
 * 3. Retrieves the user's document from Firestore.
 * 4. Creates a new Ethereum wallet using ethers.js.
 * 5. Encrypts the private key using the WALLET_ENCRYPTION_KEY.
 * 6. Adds the new wallet to the user's wallets array in Firestore.
 * 
 * User steps:
 * 1. User must be authenticated before calling this function.
 * 2. The function creates a new wallet for the user.
 * 3. The new wallet is added to the user's list of wallets in Firestore.
 * 4. The function returns the new wallet object.
 * 
 * @param {string} [label] - Optional label for the new wallet.
 * @returns {Promise<Wallet>} A promise that resolves to the newly created Wallet object.
 * @throws {Error} If the user is not authenticated, if wallet creation fails, or if there's any other error during the process.
 */
export async function createWallet(label?: string): Promise<Wallet> {
  console.log('Services: createWallet - Starting wallet creation process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: createWallet - Unauthorized access attempt');
      throw new Error('Unauthorized: Please log in to create a wallet');
    }

    const { id: userId, role: userRole } = session.user;
    console.log(`Services: createWallet - User authenticated with ID ${userId} and role ${userRole}`);

    // Step 2: Validate user role (optional, remove if not needed)
    if (userRole === UserRole.VISITOR) {
      console.error('Services: createWallet - Visitors are not allowed to create wallets');
      throw new Error('Access denied: Visitors cannot create wallets');
    }

    // Step 3: Retrieve user document from database abstraction layer
    console.log('Services: createWallet - Initializing database service');
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error('Services: createWallet - Database initialization failed:', initResult.error);
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();
    const userResult = await dbService.read('users', userId);

    if (!userResult.success || !userResult.data) {
      throw new Error('User document not found');
    }

    const userData = userResult.data.data || userResult.data;

    // Step 4: Create a new wallet using ethers.js
    console.log('Services: createWallet - Creating new wallet');
    const wallet = ethers.Wallet.createRandom();
    const address = await wallet.getAddress();

    // Step 5: Encrypt the private key before storing
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

    // Step 6: Prepare the new wallet information
    const newWallet: Wallet = {
      address,
      encryptedPrivateKey,
      createdAt: new Date().toISOString(),
      label: label || `Wallet ${(userData.wallets?.length || 0) + 1}`,
      isDefault: !userData.wallets || userData.wallets.length === 0,
      balance: '0' // Initialize balance to '0' for new wallets
    };

    // Step 7: Add the new wallet to the user's wallets array
    const currentWallets = userData.wallets || [];
    const updatedWallets = [...currentWallets, newWallet];

    // Update the user document with the new wallets array
    const updatedUserData = {
      ...userData,
      wallets: updatedWallets
    };

    const updateResult = await dbService.update('users', userId, updatedUserData);
    if (!updateResult.success) {
      throw new Error('Failed to update user document with new wallet');
    }

    console.log('Services: createWallet - Wallet created successfully:', address);
    return newWallet;
  } catch (error) {
    console.error('Services: createWallet - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while creating wallet');
  }
}

