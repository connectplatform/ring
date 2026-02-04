// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { createPublicClient, http, formatEther } from 'viem'
import { polygon } from 'viem/chains'
import { auth } from "@/auth"
import { AuthUser, Wallet } from '@/features/auth/types'
import { selectDefaultWallet } from './utils'

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

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

    // Step 2: Retrieve user document from database abstraction layer
    console.log(`Services: getWalletBalance - Initializing database service`);
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error(`Services: getWalletBalance - Database initialization failed:`, initResult.error);
      throw new Error('Database initialization failed');
    }

    const dbService = getDatabaseService();
    const userResult = await dbService.read('users', userId);

    if (!userResult.success || !userResult.data) {
      console.error(`Services: getWalletBalance - User document not found for ID: ${userId}`);
      throw new Error('User document not found in database');
    }

    const userData = userResult.data.data || userResult.data;
    console.log(`Services: getWalletBalance - Retrieved userData:`, {
      hasWallets: !!userData?.wallets,
      walletsCount: userData?.wallets?.length || 0,
      wallets: userData?.wallets?.map(w => ({ address: w.address, isDefault: w.isDefault }))
    });

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

    // Step 3: Create viem public client for Polygon
    const client = createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'),
    })

    // Step 4: Fetch balance using viem
    const balance = await client.getBalance({
      address: walletAddress as `0x${string}`,
    })

    const balanceInEther = formatEther(balance)

    console.log(`Services: getWalletBalance - Balance fetched successfully for user ${userId}`);
    return balanceInEther;
  } catch (error) {
    console.error('Services: getWalletBalance - Error:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching wallet balance');
  }
}
