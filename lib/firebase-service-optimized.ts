import { 
  deleteField, 
  PartialWithFieldValue, 
  WithFieldValue, 
  Query, 
  QuerySnapshot, 
  DocumentData, 
  Firestore, 
  CollectionReference, 
  DocumentReference, 
  FieldValue,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  deleteUser, 
  linkWithPopup,
  Auth
} from 'firebase/auth';
import { auth } from '@/auth';
import { getAdminDb } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { Opportunity } from '@/types';
import { AuthUser, ProfileFormData } from '@/features/auth/types';
import { entityConverter } from '@/lib/converters/entity-converter';
import { opportunityConverter } from '@/lib/converters/opportunity-converter';
import { ethers } from 'ethers';
import { getAuth } from 'firebase/auth';
import { getUserByWalletAddress } from '@/features/auth/services/get-user-by-wallet-address';
import { createNewUserWithWallet } from '@/features/auth/services/create-new-user-with-wallet';
import { cache } from 'react';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

// ES2022: Private fields and methods
class FirebaseServiceOptimized {
  #auth: Auth | null = null;
  #adminDb: AdminFirestore | null = null;
  
  // ES2022: Static initialization block for singleton pattern
  static {
    Object.freeze(FirebaseServiceOptimized.prototype);
  }

  // React 19: Cache expensive operations
  getSession = cache(async () => {
    const session = await auth();
    if (!session) throw new Error('auth.errors.notAuthenticated');
    return session;
  });

  // ES2022: Private method with error boundary
  async #getFirebaseAuth(): Promise<Auth> {
    this.#auth ??= getAuth();
    return this.#auth;
  }

  // ES2022: Private method with memoization
  async #getAdminDb(): Promise<AdminFirestore> {
    this.#adminDb ??= await getAdminDb();
    return this.#adminDb;
  }

  // ES2022: Enhanced error handling with cause chain
  #createError(message: string, cause?: unknown): Error {
    return new Error(message, { cause });
  }

  /**
   * Sign in with Google - Optimized for React 19
   */
  async signInWithGoogle(): Promise<User> {
    try {
      const firebaseAuth = await this.#getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
      
      const result = await signInWithPopup(firebaseAuth, provider);
      
      // React 19: Prepare for concurrent features
      await this.createOrUpdateUserProfile({
        id: result.user.uid,
        email: result.user.email!,
        name: result.user.displayName ?? undefined,
        photoURL: result.user.photoURL ?? undefined,
        authProvider: 'google',
        authProviderId: result.user.uid,
        lastLogin: new Date(),
      });
      
      return result.user;
    } catch (error) {
      throw this.#createError('auth.errors.googleSignInFailed', error);
    }
  }

  /**
   * Sign in with MetaMask - ES2022 optimized
   */
  async signInWithMetaMask(): Promise<User> {
    // ES2022: Optional chaining and nullish coalescing
    const ethereum = globalThis.window?.ethereum;
    if (!ethereum) {
      throw this.#createError('auth.errors.metaMaskNotInstalled');
    }

    try {
      await ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // ES2022: Using nullish coalescing assignment
      const existingUser = await getUserByWalletAddress(address);
      
      if (existingUser) {
        await this.createOrUpdateUserProfile({ 
          id: existingUser.id, 
          lastLogin: new Date() 
        });
        return existingUser as unknown as User;
      }
      
      const newUser = await createNewUserWithWallet([address]);
      return newUser as unknown as User;
    } catch (error) {
      throw this.#createError('auth.errors.metaMaskSignInFailed', error);
    }
  }

  /**
   * Get user by email - Optimized with React 19 cache
   */
  getUserByEmail = cache(async (email: string): Promise<AuthUser | null> => {
    try {
      const adminDb = await this.#getAdminDb();
      const usersRef = adminDb.collection('userProfiles');
      const querySnapshot = await usersRef.where('email', '==', email).limit(1).get();
      
      if (querySnapshot.empty) {
        return null;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      
      // Try API route first for consistency
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
        const response = await fetch(`${baseUrl}/api/profile/${userId}`, {
          next: { revalidate: 60 }, // Next.js 15 caching
        });

        if (response.ok) {
          const { data } = await response.json();
          return data as AuthUser;
        }
      } catch {
        // Fallback to direct processing
      }

      return this.#processUserProfile(userId, userDoc.data());
    } catch (error) {
      console.error('getUserByEmail error:', error);
      return null;
    }
  });

  /**
   * Process user profile with ES2022 features
   */
  #processUserProfile(userId: string, userData: any): AuthUser | null {
    if (!userData) return null;

    // ES2022: Object.hasOwn for safer property checking
    const hasProperty = (obj: any, prop: string) => Object.hasOwn(obj, prop);

    return {
      id: userId,
      email: userData.email,
      emailVerified: userData.emailVerified ? new Date(userData.emailVerified) : null,
      name: userData.name ?? null,
      role: userData.role,
      photoURL: userData.photoURL ?? null,
      wallets: userData.wallets ?? [],
      authProvider: userData.authProvider,
      authProviderId: userData.authProviderId,
      isVerified: userData.isVerified ?? false,
      createdAt: new Date(userData.createdAt),
      lastLogin: new Date(userData.lastLogin),
      bio: userData.bio,
      canPostconfidentialOpportunities: userData.canPostconfidentialOpportunities ?? false,
      canViewconfidentialOpportunities: userData.canViewconfidentialOpportunities ?? false,
      postedopportunities: userData.postedopportunities ?? [],
      savedopportunities: userData.savedopportunities ?? [],
      nonce: userData.nonce,
      nonceExpires: userData.nonceExpires,
      notificationPreferences: {
        email: userData.notificationPreferences?.email ?? true,
        inApp: userData.notificationPreferences?.inApp ?? true,
        sms: userData.notificationPreferences?.sms ?? false,
      },
      settings: {
        language: userData.settings?.language ?? 'en',
        theme: userData.settings?.theme ?? 'light',
        notifications: userData.settings?.notifications ?? false,
        notificationPreferences: {
          email: userData.settings?.notificationPreferences?.email ?? true,
          inApp: userData.settings?.notificationPreferences?.inApp ?? true,
          sms: userData.settings?.notificationPreferences?.sms ?? false,
        },
      },
    };
  }

  /**
   * Create or update user profile - Optimized for concurrent updates
   */
  async createOrUpdateUserProfile(user: Partial<AuthUser> & { id: string }): Promise<void> {
    try {
      const adminDb = await this.#getAdminDb();
      const docRef = adminDb.collection('userProfiles').doc(user.id);
      
      // ES2022: Using Object.entries with destructuring
      const updateData = Object.fromEntries(
        Object.entries(user).filter(([_, value]) => value !== undefined)
      );
      
      await docRef.set(updateData, { merge: true });
    } catch (error) {
      throw this.#createError('user.errors.profileUpdateFailed', error);
    }
  }

  /**
   * Batch update entities - Optimized with ES2022 features
   */
  async batchUpdateEntities(updates: Array<{ id: string, data: PartialWithFieldValue<Entity> }>): Promise<void> {
    if (!updates.length) return;

    try {
      const adminDb = await this.#getAdminDb();
      const batch = adminDb.batch();
      const entitiesCol = adminDb.collection('entities').withConverter(entityConverter);

      // ES2022: Array.prototype.group would be nice here, but using Map for now
      const updateMap = new Map(updates.map(({ id, data }) => [id, data]));

      for (const [id, data] of updateMap) {
        const docRef = entitiesCol.doc(id);
        batch.update(docRef, data);
      }

      await batch.commit();
    } catch (error) {
      throw this.#createError('entities.errors.batchUpdateFailed', error);
    }
  }

  /**
   * Bulk write opportunities - Optimized for performance
   */
  async bulkWriteOpportunities(opportunities: Array<WithFieldValue<Opportunity>>): Promise<void> {
    if (!opportunities.length) return;

    const BATCH_SIZE = 500; // Firestore batch limit
    const adminDb = await this.#getAdminDb();
    const opportunitiesCol = adminDb.collection('opportunities').withConverter(opportunityConverter);

    try {
      // Process in batches for large datasets
      for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const batchOpportunities = opportunities.slice(i, i + BATCH_SIZE);

        for (const opportunity of batchOpportunities) {
          const docRef = opportunitiesCol.doc();
          batch.set(docRef, opportunity);
        }

        await batch.commit();
      }
    } catch (error) {
      throw this.#createError('opportunities.errors.bulkWriteFailed', error);
    }
  }

  /**
   * Update user profile and entities in transaction - ES2022 optimized
   */
  async updateUserProfileAndEntities(
    userId: string, 
    profileData: Partial<ProfileFormData>, 
    entityUpdates: Array<{ id: string, data: PartialWithFieldValue<Entity> }>
  ): Promise<void> {
    try {
      const adminDb = await this.#getAdminDb();
      
      await adminDb.runTransaction(async (transaction) => {
        const userRef = adminDb.collection('userProfiles').doc(userId);
        const entitiesCol = adminDb.collection('entities').withConverter(entityConverter);

        // Update user profile with timestamp
        transaction.update(userRef, {
          ...profileData,
          lastLogin: new Date(),
          updatedAt: new Date(), // Add updatedAt timestamp
        });

        // Update entities efficiently
        for (const { id, data } of entityUpdates) {
          const entityRef = entitiesCol.doc(id);
          transaction.update(entityRef, {
            ...data,
            updatedAt: new Date(),
          });
        }
      });
    } catch (error) {
      throw this.#createError('user.errors.transactionFailed', error);
    }
  }

  /**
   * Send password reset email with i18n support
   */
  async sendPasswordReset(email: string, locale: string = 'en'): Promise<void> {
    try {
      const firebaseAuth = await this.#getFirebaseAuth();
      
      // Configure action code settings with locale
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?locale=${locale}`,
        handleCodeInApp: true,
      };
      
      await sendPasswordResetEmail(firebaseAuth, email, actionCodeSettings);
    } catch (error) {
      throw this.#createError('auth.errors.passwordResetFailed', error);
    }
  }

  /**
   * Send verification email with locale support
   */
  async sendVerificationEmail(user: User, locale: string = 'en'): Promise<void> {
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?locale=${locale}`,
        handleCodeInApp: true,
      };
      
      await sendEmailVerification(user, actionCodeSettings);
    } catch (error) {
      throw this.#createError('auth.errors.verificationEmailFailed', error);
    }
  }

  /**
   * Delete user account with cleanup
   */
  async deleteUserAccount(userId: string): Promise<void> {
    const firebaseAuth = await this.#getFirebaseAuth();
    
    if (!firebaseAuth.currentUser) {
      throw this.#createError('auth.errors.noUserSignedIn');
    }

    try {
      // Delete user data first
      const adminDb = await this.#getAdminDb();
      const batch = adminDb.batch();
      
      // Delete user profile
      batch.delete(adminDb.collection('userProfiles').doc(userId));
      
      // Delete user's entities
      const entitiesSnapshot = await adminDb
        .collection('entities')
        .where('userId', '==', userId)
        .get();
      
      entitiesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Finally delete auth account
      await deleteUser(firebaseAuth.currentUser);
    } catch (error) {
      throw this.#createError('auth.errors.accountDeletionFailed', error);
    }
  }

  /**
   * Link Google account with error handling
   */
  async linkGoogleAccount(userId: string): Promise<void> {
    const firebaseAuth = await this.#getFirebaseAuth();
    
    if (!firebaseAuth.currentUser) {
      throw this.#createError('auth.errors.noUserSignedIn');
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(firebaseAuth.currentUser, provider);
      
      await this.createOrUpdateUserProfile({
        id: userId,
        name: result.user.displayName ?? undefined,
        email: result.user.email ?? undefined,
        photoURL: result.user.photoURL ?? undefined,
        authProvider: 'google',
        authProviderId: result.user.uid,
      });
    } catch (error) {
      throw this.#createError('auth.errors.accountLinkingFailed', error);
    }
  }
}

// Export singleton instance
export const firebaseService = new FirebaseServiceOptimized();

// ES2022: Export type for better TypeScript support
export type { FirebaseServiceOptimized }; 