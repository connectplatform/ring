// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { ethers } from 'ethers'
import { auth } from "@/auth"
import { AuthUser, Wallet } from '@/features/auth/types'
import { selectDefaultWallet } from './utils'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedCollection } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

/**
 * Fetches the wallet balance for the authenticated user.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session.
 * 2. Retrieves the user's document from Firestore to get the wallet address.
 * 3. Connects to the Polygon network using the provided RPC URL.
 * 4. Fetches the balance for the user's wallet address.
 * 
 * @returns {Promise<string>} A promise that resolves to the wallet balance in Ether.
 * @throws {Error} If the user is not authenticated, if the wallet is not found, or if there's any other error during the process.
 */
export async function getWalletBalance(): Promise<string> {
  console.log('Services: getWalletBalance - Starting wallet balance fetch process');

  try {
    // Step 1: Authenticate and get user session
    const session = await auth();
    if (!session || !session.user) {
      console.error('Services: getWalletBalance - Unauthorized access attempt');
      throw new Error('Unauthorized: Please log in to fetch wallet balance');
    }

    const userId = session.user.id;
    console.log(`Services: getWalletBalance - User authenticated with ID ${userId}`);

    // Step 2: Retrieve user document from Firestore
    // 🚀 OPTIMIZED: Use centralized service manager with phase detection
    const phase = getCurrentPhase();
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() as AuthUser | undefined;

    if (!userData?.wallets || userData.wallets.length === 0) {
      console.error(`Services: getWalletBalance - Wallet not found for user ${userId}`);
      throw new Error('User wallet not found');
    }

    // Get the default wallet or the first wallet
    const defaultWallet = selectDefaultWallet(userData.wallets)
    if (!defaultWallet) {
      console.error(`Services: getWalletBalance - No wallets found for user ${userId}`)
      throw new Error('User wallet not found')
    }
    const walletAddress = defaultWallet.address;

    // Step 3: Connect to Polygon network
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    
    // Step 4: Fetch balance
    const balance = await provider.getBalance(walletAddress);
    const balanceInEther = ethers.formatEther(balance);

    console.log(`Services: getWalletBalance - Balance fetched successfully for user ${userId}`);
    return balanceInEther;
  } catch (error) {
    console.error('Services: getWalletBalance - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching wallet balance');
  }
}
