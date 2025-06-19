import { ethers } from 'ethers'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { getServerAuthSession } from "@/auth"
import { AuthUser, Wallet } from '@/features/auth/types'

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
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.error('Services: getWalletBalance - Unauthorized access attempt');
      throw new Error('Unauthorized: Please log in to fetch wallet balance');
    }

    const userId = session.user.id;
    console.log(`Services: getWalletBalance - User authenticated with ID ${userId}`);

    // Step 2: Retrieve user document from Firestore
    const adminDb = await getAdminDb();
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() as AuthUser | undefined;

    if (!userData?.wallets || userData.wallets.length === 0) {
      console.error(`Services: getWalletBalance - Wallet not found for user ${userId}`);
      throw new Error('User wallet not found');
    }

    // Get the default wallet or the first wallet
    const defaultWallet = userData.wallets.find((wallet: Wallet) => wallet.isDefault) || userData.wallets[0];
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
