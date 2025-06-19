import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin.server';
import { AuthUser, UserRole, UserSettings, Wallet, NotificationPreferences } from '@/features/auth/types';
import { auth } from '@/auth'; // Auth.js v5 session handler
import { ethers } from 'ethers';

/**
 * Creates a new user with associated wallet(s) or updates an existing user
 * 
 * This function performs the following steps:
 * 1. Checks if the creation is being done by an admin
 * 2. Retrieves the Firestore admin instance
 * 3. Checks if the user already exists
 * 4. Creates a new user or updates an existing one
 * 5. Creates wallet objects for each provided address
 * 6. Saves or updates the user data in Firestore
 * 
 * User steps:
 * 1. User initiates account creation (either self-registration or admin-created)
 * 2. Function checks if the user already exists
 * 3. If user doesn't exist, a new user profile is created
 * 4. Wallet(s) are created and associated with the user
 * 5. User data is saved to Firestore
 * 
 * @param {string[]} addresses - An array of wallet addresses to associate with the user
 * @param {string} [email] - Optional email address for the user
 * @returns {Promise<AuthUser | null>} A Promise that resolves to the created/updated AuthUser object, or null if an error occurs
 */
export async function createNewUserWithWallet(
  addresses: string[],
  email?: string
): Promise<AuthUser | null> {
  console.log(`Services: createNewUserWithWallet - Starting creation process for ${addresses.length} wallet address(es)`);

  try {
    // Step 1: Check if the creation is being done by an admin
    const session = await auth();
    const isAdminCreation = !!session && session.user?.role === UserRole.ADMIN;

    if (isAdminCreation) {
      console.log(`Services: createNewUserWithWallet - Admin user authenticated with ID ${session.user.id}`);
    } else {
      console.log('Services: createNewUserWithWallet - New user self-registration with wallet(s)');
    }

    // Step 2: Get admin database instance
    const adminDb = await getAdminDb();
    const usersCollection = adminDb.collection('users');
    const userDoc = usersCollection.doc(addresses[0]);

    // Step 3: Check if user already exists
    let user: AuthUser;
    const userSnapshot = await userDoc.get();

    if (userSnapshot.exists) {
      // User already exists, update their data
      user = userSnapshot.data() as AuthUser;
      console.log(`Services: createNewUserWithWallet - Existing user found with address: ${addresses[0]}`);
    } else {
      // Step 4: Create a new user
      const defaultNotificationPreferences: NotificationPreferences = {
        email: true,
        inApp: true,
        sms: false,
      };

      const defaultSettings: UserSettings = {
        language: 'en',
        theme: 'light',
        notifications: false,
        notificationPreferences: defaultNotificationPreferences,
      };

      user = {
        id: addresses[0],
        email: email || addresses[0], // Use address as email if not provided
        emailVerified: null,
        name: null,
        role: isAdminCreation ? (session?.user.role as UserRole) : UserRole.SUBSCRIBER,
        photoURL: null,
        wallets: [],
        isVerified: false,
        createdAt: new Date(),
        lastLogin: new Date(),
        canPostconfidentialOpportunities: false,
        canViewconfidentialOpportunities: false,
        postedopportunities: [],
        savedopportunities: [],
        notificationPreferences: defaultNotificationPreferences,
        settings: defaultSettings,
        authProvider: 'metamask',
        authProviderId: addresses[0],
      };
      console.log(`Services: createNewUserWithWallet - Creating new user with address: ${addresses[0]}`);
    }

    // Step 5: Create wallet objects for each address
    const wallets: Wallet[] = await Promise.all(addresses.map(async (address, index) => {
      const wallet = ethers.Wallet.createRandom();
      const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Wallet encryption key is not set');
      }
      const encryptedPrivateKey = await wallet.encrypt(encryptionKey);

      return {
        address,
        encryptedPrivateKey,
        createdAt: new Date().toISOString(),
        label: `Wallet ${index + 1}`,
        isDefault: index === 0,
        balance: '0', // Initialize balance to '0' for new wallets
      };
    }));

    user.wallets = wallets;

    // Step 6: Save or update user data in Firestore
    await userDoc.set(user, { merge: true });

    console.log(`Services: createNewUserWithWallet - User profile created/updated in Firestore for address: ${addresses[0]} with ${wallets.length} wallet(s)`);

    return user;

  } catch (error) {
    console.error('Services: createNewUserWithWallet - Error creating new user with wallet:', error);
    return null;
  }
}

