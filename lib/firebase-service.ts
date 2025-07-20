import { deleteField, PartialWithFieldValue, WithFieldValue, Query, QuerySnapshot, DocumentData, Firestore, CollectionReference, DocumentReference, FieldValue } from 'firebase/firestore';
import { User, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, deleteUser, linkWithPopup } from 'firebase/auth';
import { auth } from '@/auth'; // Auth.js for session handling
import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { Opportunity, OpportunityType, OpportunityVisibility } from '@/types';
import { AuthUser, UserRole, ProfileFormData, UserSettings } from '@/features/auth/types';
import { entityConverter } from '@/lib/converters/entity-converter';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { ethers } from 'ethers';
import { getAuth } from 'firebase/auth';
import { getUserByWalletAddress } from '@/services/users/get-user-by-wallet-address';
import { createNewUserWithWallet } from '@/services/users/create-new-user-with-wallet';

/**
 * FirebaseService object
 * 
 * This object contains methods for interacting with Firebase services,
 * including authentication, user management, and data operations.
 */
const FirebaseService = {
  /**
   * Fetch the session using Auth.js
   * 
   * User steps:
   * 1. Call this function to get the current user session
   * 2. Use the returned session data in your application logic
   * 
   * @returns {Promise<Session | null>} The user session or null if not authenticated
   * @throws {Error} If the user is not authenticated
   */
  async getSession() {
    const session = await auth();
    if (!session) throw new Error('User is not authenticated');
    return session;
  },

  /**
   * Sign in with Google
   * 
   * User steps:
   * 1. Call this function to initiate Google sign-in
   * 2. Handle the returned User object or any errors
   * 
   * @returns {Promise<User>} The signed-in user
   * @throws {Error} If there's an error during the sign-in process
   */
  async signInWithGoogle(): Promise<User> {
    const firebaseAuth = getAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
    try {
      const result = await signInWithPopup(firebaseAuth, provider);
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  },

  /**
   * Sign in with MetaMask
   * 
   * User steps:
   * 1. Ensure MetaMask is installed and connected
   * 2. Call this function to initiate MetaMask sign-in
   * 3. Handle the returned User object or any errors
   * 
   * @returns {Promise<User>} The signed-in user
   * @throws {Error} If MetaMask is not installed or if there's an error during the sign-in process
   */
  async signInWithMetaMask(): Promise<User> {
    if (typeof window === 'undefined' || !('ethereum' in window)) {
      throw new Error('MetaMask is not installed or not available in this environment');
    }
  
    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
  
      const existingUser = await getUserByWalletAddress(address);
  
      if (existingUser) {
        await this.createOrUpdateUserProfile({ id: existingUser.id, lastLogin: new Date() });
        return existingUser as unknown as User;
      } else {
        const newUser = await createNewUserWithWallet([address]);
        return newUser as unknown as User;
      }
    } catch (error) {
      console.error('Error signing in with MetaMask:', error);
      throw error;
    }
  },

  /**
   * Link Google account to existing user
   * 
   * User steps:
   * 1. Call this function with the user ID to link
   * 2. Handle any errors that may occur during the process
   * 
   * @param {string} userId - The ID of the user to link the Google account to
   * @returns {Promise<void>}
   * @throws {Error} If no user is currently signed in or if there's an error during the linking process
   */
  async linkGoogleAccount(userId: string): Promise<void> {
    const firebaseAuth = getAuth();
    const provider = new GoogleAuthProvider();
    
    try {
      if (firebaseAuth.currentUser) {
        await linkWithPopup(firebaseAuth.currentUser, provider);
        const user = firebaseAuth.currentUser;
        await this.createOrUpdateUserProfile({
          id: userId,
          name: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || '',
          authProvider: 'google',
          authProviderId: user.uid,
        });
      } else {
        throw new Error('No user is currently signed in');
      }
    } catch (error) {
      console.error("Error linking Google account:", error);
      throw error;
    }
  },

  /**
   * Sign in with email and password
   * 
   * User steps:
   * 1. Call this function with email and password
   * 2. Handle the returned User object or any errors
   * 
   * @param {string} email - The user's email
   * @param {string} password - The user's password
   * @returns {Promise<User>} The signed-in user
   * @throws {Error} If there's an error during the sign-in process
   */
  async signInWithEmail(email: string, password: string): Promise<User> {
    const firebaseAuth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error("Error signing in with email and password:", error);
      throw error;
    }
  },

  /**
   * Get user by email using API route for consistency
   * 
   * User steps:
   * 1. Call this function with an email address
   * 2. Handle the returned AuthUser object or null
   * 
   * @param {string} email - The email address to search for
   * @returns {Promise<AuthUser | null>} The user associated with the email or null if not found
   */
  async getUserByEmail(email: string): Promise<AuthUser | null> {
    // ES2022 Logical Assignment for request context
    const requestContext = {
      timestamp: Date.now(),
      operation: 'getUserByEmail',
      email
    } as any;

    try {
      const adminDb = await getAdminDb();
      const usersRef = adminDb.collection('userProfiles');
      const q = usersRef.where('email', '==', email);
      const querySnapshot = await q.get();
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userId = userDoc.id;
        
        // ES2022 logical assignment for context
        requestContext.userId ??= userId;
        requestContext.hasUserDoc ??= true;
        
        console.log('FirebaseService: getUserByEmail - User found, fetching profile via API route');
        
        // Use API route
        try {
          const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // Note: This assumes server-side context with proper authentication
              // In practice, this method should be called from authenticated contexts
            },
          });

          if (!apiResponse.ok) {
            console.error('FirebaseService: getUserByEmail - API route failed:', apiResponse.statusText);
            // Fallback: query user data directly if API route fails
            return this.getUserProfileFallback(userId, userDoc.data());
          }

          const apiResult = await apiResponse.json();
          
          if (apiResult.success && apiResult.data) {
            console.log('FirebaseService: getUserByEmail - Profile fetched successfully via API route');
            return apiResult.data as AuthUser;
          }
          
          // Fallback if API response doesn't have expected structure
          return this.getUserProfileFallback(userId, userDoc.data());
          
        } catch (apiError) {
          console.warn('FirebaseService: getUserByEmail - API route unavailable, using fallback:', apiError);
          // Fallback to direct data processing if API route is unavailable
          return this.getUserProfileFallback(userId, userDoc.data());
        }
      }
      
      console.log('FirebaseService: getUserByEmail - No user found with email:', email);
      return null;
      
    } catch (error) {
      console.error("FirebaseService: getUserByEmail - Error:", error);
      return null;
    }
  },

  /**
   * Fallback method to process user profile data directly
   * Used when API route is unavailable
   * 
   * @private
   * @param {string} userId - The user ID
   * @param {any} userData - The user document data
   * @returns {AuthUser | null} The processed user profile
   */
  getUserProfileFallback(userId: string, userData: any): AuthUser | null {
    try {
      if (!userData) {
        return null;
      }

      // ES2022 logical assignment for default values
      const userProfile: AuthUser = {
        id: userId,
        email: userData.email,
        emailVerified: userData.emailVerified ? new Date(userData.emailVerified) : null,
        name: userData.name || null,
        role: userData.role,
        photoURL: userData.photoURL || null,
        wallets: userData.wallets || [],
        authProvider: userData.authProvider,
        authProviderId: userData.authProviderId,
        isVerified: userData.isVerified,
        createdAt: new Date(userData.createdAt),
        lastLogin: new Date(userData.lastLogin),
        bio: userData.bio || undefined,
        canPostconfidentialOpportunities: userData.canPostconfidentialOpportunities,
        canViewconfidentialOpportunities: userData.canViewconfidentialOpportunities,
        postedopportunities: userData.postedopportunities || [],
        savedopportunities: userData.savedopportunities || [],
        nonce: userData.nonce,
        nonceExpires: userData.nonceExpires,
        notificationPreferences: userData.notificationPreferences || {
          email: true,
          inApp: true,
          sms: false,
        },
        settings: userData.settings || {
          language: 'en',
          theme: 'light',
          notifications: false,
          notificationPreferences: {
            email: true,
            inApp: true,
            sms: false,
          },
        },
      };

      // ES2022 logical assignment for optional fields
      userProfile.settings.language ??= 'en';
      userProfile.settings.theme ??= 'light';
      userProfile.settings.notifications ??= false;
      
      return userProfile;
    } catch (error) {
      console.error("FirebaseService: getUserProfileFallback - Error processing user data:", error);
      return null;
    }
  },

  /**
   * Create or update user profile
   * 
   * User steps:
   * 1. Prepare the user data object with at least the 'id' field
   * 2. Call this function with the user data
   * 3. Handle any errors that may occur during the process
   * 
   * @param {Partial<AuthUser> & { id: string }} user - The user data to create or update
   * @returns {Promise<void>} A Promise that resolves when the operation is complete
   * @throws {Error} If there's an error during the create/update process
   */
  async createOrUpdateUserProfile(user: Partial<AuthUser> & { id: string }): Promise<void> {
    try {
      const adminDb = getAdminDb();
      const docRef = adminDb.collection('userProfiles').doc(user.id);
      await docRef.set(user, { merge: true });
      console.log(`User profile created/updated for userId: ${user.id}`);
    } catch (error) {
      console.error("Error creating or updating user profile:", error);
      throw error;
    }
  },

  /**
   * Batch update entities
   * 
   * User steps:
   * 1. Prepare an array of entity updates (id and data to update)
   * 2. Call this function with the updates array
   * 3. Handle any errors that may occur during the process
   * 
   * @param {Array<{ id: string, data: PartialWithFieldValue<Entity> }>} updates - An array of entity updates
   * @returns {Promise<void>} A Promise that resolves when the operation is complete
   * @throws {Error} If there's an error during the batch update process
   */
  async batchUpdateEntities(updates: Array<{ id: string, data: PartialWithFieldValue<Entity> }>): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      const batch = adminDb.batch();
      const entitiesCol = adminDb.collection('entities').withConverter(entityConverter);

      updates.forEach(({ id, data }) => {
        const docRef = entitiesCol.doc(id);
        batch.update(docRef, data);
      });

      await batch.commit();
    } catch (error) {
      console.error("Error batch updating entities:", error);
      throw error;
    }
  },

  /**
   * Bulk write opportunities
   * 
   * User steps:
   * 1. Prepare an array of opportunity objects to be written
   * 2. Call this function with the array of opportunities
   * 3. Handle any errors that may occur during the process
   * 
   * @param {Array<WithFieldValue<Opportunity>>} opportunities - An array of opportunities to be written
   * @returns {Promise<void>} A Promise that resolves when the operation is complete
   * @throws {Error} If there's an error during the bulk write process
   */
  async bulkWriteOpportunities(opportunities: Array<WithFieldValue<Opportunity>>): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      const bulkWriter = adminDb.bulkWriter();
      const opportunitiesCol = adminDb.collection('opportunities').withConverter(opportunityConverter);

      opportunities.forEach((opportunity) => {
        const docRef = opportunitiesCol.doc();
        bulkWriter.create(docRef, opportunity);
      });

      await bulkWriter.close();
    } catch (error) {
      console.error("Error bulk writing opportunities:", error);
      throw error;
    }
  },

  /**
   * Update user profile and related entities in a transaction
   * 
   * User steps:
   * 1. Prepare the user profile data and entity updates
   * 2. Call this function with the user ID, profile data, and entity updates
   * 3. Handle any errors that may occur during the process
   * 
   * @param {string} userId - The ID of the user whose profile to update
   * @param {Partial<ProfileFormData>} profileData - The user profile data to update
   * @param {Array<{ id: string, data: PartialWithFieldValue<Entity> }>} entityUpdates - An array of entity updates
   * @returns {Promise<void>}
   * @throws {Error} If there's an error during the transaction process
   */
  async updateUserProfileAndEntities(userId: string, profileData: Partial<ProfileFormData>, entityUpdates: Array<{ id: string, data: PartialWithFieldValue<Entity> }>): Promise<void> {
    try {
      const adminDb = await getAdminDb();
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('userProfiles').doc(userId);
        const entitiesCol = adminDb.collection('entities').withConverter(entityConverter);

        // Update user profile
        transaction.update(userRef, {
          ...profileData,
          lastLogin: new Date(),
        });

        // Update related entities
        entityUpdates.forEach(({ id, data }) => {
          const entityRef = entitiesCol.doc(id);
          transaction.update(entityRef, data);
        });
      });

      console.log(`Successfully updated profile and entities for user ${userId}`);
    } catch (error) {
      console.error("Error updating user profile and entities:", error);
      throw error;
    }
  },

  /**
   * Send a password reset email
   * 
   * User steps:
   * 1. Call this function with the user's email address
   * 2. Handle any errors that may occur during the process
   * 
   * @param {string} email - The email address to send the password reset to
   * @returns {Promise<void>}
   * @throws {Error} If there's an error sending the password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    const firebaseAuth = getAuth();
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  },

  /**
   * Send a verification email
   * 
   * User steps:
   * 1. Call this function with the User object
   * 2. Handle any errors that may occur during the process
   * 
   * @param {User} user - The User object to send the verification email to
   * @returns {Promise<void>}
   * @throws {Error} If there's an error sending the verification email
   */
  async sendVerificationEmail(user: User): Promise<void> {
    try {
      await sendEmailVerification(user);
      console.log("Verification email sent successfully");
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw error;
    }
  },

  /**
   * Delete a user account
   * 
   * User steps:
   * 1. Call this function with the user ID to delete
   * 2. Handle any errors that may occur during the process
   * 
   * @param {string} userId - The ID of the user account to delete
   * @returns {Promise<void>}
   * @throws {Error} If no user is currently signed in or if there's an error during the deletion process
   */
  async deleteUserAccount(userId: string): Promise<void> {
    const firebaseAuth = getAuth();
    if (firebaseAuth.currentUser) {
      try {
        await deleteUser(firebaseAuth.currentUser);
        // Additional cleanup if needed (e.g., deleting user data from Firestore)
      } catch (error) {
        console.error("Error deleting user account:", error);
        throw error;
      }
    } else {
      throw new Error('No user is currently signed in');
    }
  },
};

export default FirebaseService;

