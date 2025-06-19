import { getAdminDb } from '@/lib/firebase-admin.server';
import { AuthUser, UserRole } from '@/features/auth/types';
import { auth } from '@/auth'; // Auth.js v5 session handler

/**
 * Create a new user in Firestore, with authentication and role-based access control.
 * 
 * This function performs the following steps:
 * 1. Authenticates the requesting user (if applicable)
 * 2. Validates the input data
 * 3. Prepares the user data with default values
 * 4. Creates a new user document in Firestore
 * 
 * User steps:
 * 1. A new user signs up or an admin creates a new user account
 * 2. The function is called with the new user's data
 * 3. If successful, a new user document is created in Firestore
 * 
 * @param {Partial<AuthUser>} userData - The data for the new user to be created
 * @param {string} [userData.id] - Optional user ID. If not provided, a new ID will be generated
 * @param {string} userData.email - The email address of the new user (required)
 * @param {string} userData.name - The name of the new user (required)
 * @param {UserRole} [userData.role] - The role of the new user. Defaults to SUBSCRIBER if not provided
 * @param {string} [userData.authProvider] - The authentication provider. Defaults to 'credentials'
 * @param {string} [userData.authProviderId] - The ID from the auth provider. Defaults to the user's Firestore ID
 * @param {boolean} [userData.isVerified] - Whether the user is verified. Defaults to false
 * @param {Date} [userData.emailVerified] - The date the email was verified. Defaults to null
 * 
 * @returns {Promise<AuthUser | null>} A promise that resolves to the created AuthUser object or null if creation failed
 * 
 * @throws {Error} If the email or name is not provided
 * @throws {Error} If the requesting user is not authenticated (for admin creation)
 */
export async function createUser(userData: Partial<AuthUser>): Promise<AuthUser | null> {
  console.log('Services: createUser - Starting user creation process');

  try {
    // Step 1: Authenticate and get session of the requesting user (if applicable)
    const session = await auth();
    const isAdminCreation = !!session && session.user?.role === UserRole.ADMIN;

    if (isAdminCreation) {
      console.log(`Services: createUser - Admin user authenticated with ID ${session.user.id}`);
    } else {
      console.log('Services: createUser - New user self-registration');
    }

    // Step 2: Validate input data
    if (!userData.email || !userData.name) {
      throw new Error('Email and name are required fields');
    }

    // Step 3: Firestore setup
    const adminDb = getAdminDb();
    const usersCollection = adminDb.collection('users');

    // Step 4: Prepare user data
    const userId = userData.id || usersCollection.doc().id; // Generate a new ID if not provided
    const newUser: AuthUser = {
      id: userId,
      email: userData.email,
      name: userData.name,
      role: isAdminCreation ? (userData.role || UserRole.SUBSCRIBER) : UserRole.SUBSCRIBER,
      createdAt: new Date(),
      lastLogin: new Date(),
      isVerified: userData.isVerified || false,
      emailVerified: userData.emailVerified || null,
      authProvider: userData.authProvider || 'credentials',
      authProviderId: userData.authProviderId || userId,
      settings: {
        language: 'en',
        theme: 'system',
        notifications: true,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      },
      canPostconfidentialOpportunities: false,
      canViewconfidentialOpportunities: false,
      postedopportunities: [],
      savedopportunities: [],
      notificationPreferences: {
        sms: false,
        email: true,
        inApp: true,
      },
      wallets: [], // Initialize with an empty array of wallets
    };

    // Step 5: Create the user document in Firestore
    await usersCollection.doc(newUser.id).set(newUser);

    console.log(`Services: createUser - User created successfully with ID: ${newUser.id}`);
    return newUser;

  } catch (error) {
    console.error('Services: createUser - Error creating user:', error);
    return null; // Indicate failure by returning null
  }
}
