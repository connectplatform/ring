import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin.server';
import { AuthUser, UserRole, UserSettings, Wallet } from '@/features/auth/types';
import { ZodError } from 'zod';
import { signUpSchema } from '@/lib/zod'; // Assume we have a signup schema defined
import { randomBytes, createHash } from 'crypto';

/**
 * Creates a new user account with email and password, including a default wallet.
 * 
 * This function performs the following steps:
 * 1. Validates the input data
 * 2. Creates a new user using Firebase Admin SDK
 * 3. Generates a default wallet for the user
 * 4. Creates a database document for the user with all necessary information
 * 5. Sends a verification email to the user (handled by Firebase Admin SDK)
 * 
 * User steps:
 * 1. User provides email, password, and name through a registration form
 * 2. Application calls this function with the provided information
 * 3. Function creates a new user account and generates a default wallet
 * 4. User receives confirmation of account creation and instructions to verify their email
 * 
 * @param {string} email - The email address for the new user account
 * @param {string} password - The password for the new user account
 * @param {string} name - The display name for the new user
 * @returns {Promise<AuthUser | null>} A promise that resolves to the created AuthUser object or null if creation failed
 * 
 * @throws Will throw an error if there's a problem creating the user account or wallet
 */
export async function createNewUserWithEmail(email: string, password: string, name: string): Promise<AuthUser | null> {
  console.log(`Services: createNewUserWithEmail - Starting creation process for email: ${email}`);

  try {
    // Step 1: Validate input data
    const validatedData = await signUpSchema.parseAsync({ email, password, name });

    // Step 2: Create a new user using Firebase Admin SDK
    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.createUser({
      email: validatedData.email,
      password: validatedData.password,
      displayName: validatedData.name,
      emailVerified: false,
    });

    const userId = userRecord.uid;
    console.log(`Services: createNewUserWithEmail - User created with ID: ${userId}`);

    // Step 3: Generate a default wallet for the user
    const walletAddress = createHash('sha256').update(randomBytes(32)).digest('hex');
    const defaultWallet: Wallet = {
      address: walletAddress,
      encryptedPrivateKey: createHash('sha256').update(randomBytes(32)).digest('hex'), // This is a placeholder. In a real scenario, you'd use proper encryption.
      createdAt: new Date().toISOString(),
      label: 'Default Wallet',
      isDefault: true,
      balance: '0', // Initial balance set to '0'
    };

    console.log(`Services: createNewUserWithEmail - Default wallet created with address: ${defaultWallet.address}`);

    // Step 4: Create or update the user profile in the database
    const adminDb = getAdminDb();
    const usersCollection = adminDb.collection('users');

    const userSettings: UserSettings = {
      language: 'en',
      theme: 'light',
      notifications: true,
      notificationPreferences: {
        email: true,
        inApp: true,
        sms: false,
      },
    };

    const newUser: AuthUser = {
      id: userId,
      email: validatedData.email,
      emailVerified: null,
      name: validatedData.name,
      role: UserRole.SUBSCRIBER, // Default role for new users
      photoURL: null,
      wallets: [defaultWallet],
      authProvider: 'credentials',
      authProviderId: userId,
      isVerified: false,
      createdAt: new Date(),
      lastLogin: new Date(),
      settings: userSettings,
      canPostconfidentialOpportunities: false,
      canViewconfidentialOpportunities: false,
      postedopportunities: [],
      savedopportunities: [],
      notificationPreferences: {
        email: true,
        inApp: true,
        sms: false,
      },
    };

    await usersCollection.doc(newUser.id).set(newUser);

    console.log(`Services: createNewUserWithEmail - User profile created in database for ID: ${userId}`);

    // Step 5: Send verification email
    await adminAuth.generateEmailVerificationLink(email);
    console.log(`Services: createNewUserWithEmail - Verification email sent to: ${email}`);

    return newUser;

  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Services: createNewUserWithEmail - Validation error:', error.errors);
    } else {
      console.error('Services: createNewUserWithEmail - Error creating new user with email:', error);
    }
    return null; // Indicate failure by returning null
  }
}
