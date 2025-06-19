// import { createWallet, getWalletBalance, ensureUserWallet } from '@/features/wallet/utils';
// import { ethers } from 'ethers';
// import { AuthUser } from '@/features/auth/types';
// import { getUserByWalletAddress } from '@/services/users/getUserByWalletAddress';
// import { createNewUserWithWallet } from '@/services/users/createNewUserWithWallet';

// /**
//  * WalletService: Handles all wallet-related operations
//  * 
//  * This service provides methods for creating wallets, checking balances,
//  * and handling MetaMask sign-ins.
//  */
// export const WalletService = {
//   /**
//    * Create a new wallet
//    * 
//    * User steps:
//    * 1. User requests to create a new wallet
//    * 2. New wallet is created and address is returned
//    * 
//    * @returns {Promise<{ address: string }>} A promise that resolves to an object containing the new wallet address
//    * @throws {Error} If there's an error creating the wallet
//    */
//   async createWallet(): Promise<{ address: string }> {
//     try {
//       return await createWallet();
//     } catch (error) {
//       console.error("Error creating wallet:", error);
//       throw error;
//     }
//   },

//   /**
//    * Get wallet balance
//    * 
//    * User steps:
//    * 1. User requests to view their wallet balance
//    * 2. Wallet balance is fetched and returned
//    * 
//    * @returns {Promise<string>} A promise that resolves to the wallet balance as a string
//    * @throws {Error} If there's an error fetching the wallet balance
//    */
//   async getWalletBalance(): Promise<string> {
//     try {
//       return await getWalletBalance();
//     } catch (error) {
//       console.error("Error getting wallet balance:", error);
//       throw error;
//     }
//   },

//   /**
//    * Ensure user has a wallet
//    * 
//    * User steps:
//    * 1. User performs an action requiring a wallet
//    * 2. System checks if user has a wallet, creates one if not
//    * 3. Wallet address is returned
//    * 
//    * @returns {Promise<string>} A promise that resolves to the user's wallet address
//    * @throws {Error} If there's an error ensuring the user wallet
//    */
//   async ensureUserWallet(): Promise<string> {
//     try {
//       return await ensureUserWallet();
//     } catch (error) {
//       console.error("Error ensuring user wallet:", error);
//       throw error;
//     }
//   },

//   /**
//    * Sign in with MetaMask
//    * 
//    * User steps:
//    * 1. User clicks "Sign in with MetaMask" button
//    * 2. MetaMask popup appears, asking for connection
//    * 3. User approves the connection
//    * 4. System checks if a user with this wallet exists, creates one if not
//    * 5. User is signed in
//    * 
//    * @returns {Promise<AuthUser>} A promise that resolves to the authenticated user
//    * @throws {Error} If MetaMask is not installed or there's an error during the sign-in process
//    */
//   async signInWithMetaMask(): Promise<AuthUser> {
//     if (typeof window === 'undefined' || !('ethereum' in window)) {
//       throw new Error('MetaMask is not installed or not available in this environment');
//     }
  
//     try {
//       await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
//       const provider = new ethers.BrowserProvider((window as any).ethereum);
//       const signer = await provider.getSigner();
//       const address = await signer.getAddress();
  
//       // Check if a user with this wallet address already exists
//       const existingUser = await getUserByWalletAddress(address);
  
//       if (existingUser) {
//         // User exists, update last login and return
//         // Note: updateUserProfile should be imported from userService
//         // await updateUserProfile(existingUser.id, { lastLogin: new Date() });
//         return existingUser;
//       } else {
//         // Create a new user
//         const newUser = await createNewUserWithWallet(address);
//         return newUser;
//       }
//     } catch (error) {
//       console.error('Error signing in with MetaMask:', error);
//       throw error;
//     }
//   },
// };

// export default WalletService;
