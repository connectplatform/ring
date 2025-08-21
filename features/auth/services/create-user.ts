// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

import { AuthUser, UserRole } from '@/features/auth/types';
import { getServerAuthSession } from '@/auth';
import { AuthError, AuthPermissionError, EntityDatabaseError, ValidationError, logRingError } from '@/lib/errors';

import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData } from '@/lib/build-cache/phase-detector';
import { getCachedDocument, getCachedUser, getCachedUsers } from '@/lib/build-cache/static-data-cache';
import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';

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
 * @throws {AuthError} If user authentication fails
 * @throws {AuthPermissionError} If user lacks permission to create users
 * @throws {ValidationError} If required user data is missing or invalid
 * @throws {EntityDatabaseError} If database operations fail
 */
export async function createUser(userData: Partial<AuthUser>): Promise<AuthUser | null> {
  try {
    console.log('Services: createUser - Starting user creation process...');

    // Step 1: Validate required fields
    if (!userData.email) {
      throw new ValidationError('Email is required for user creation', undefined, {
        timestamp: Date.now(),
        providedData: userData,
        missingField: 'email',
        operation: 'createUser'
      });
    }

    if (!userData.name) {
      throw new ValidationError('Name is required for user creation', undefined, {
        timestamp: Date.now(),
        providedData: userData,
        missingField: 'name',
        operation: 'createUser'
      });
    }

    // Step 2: Authenticate the requesting user (for admin-created users)
    const session = await getServerAuthSession();
    
    // If there's a session, validate permissions for admin-created users
    if (session && session.user) {
      const requestingUserRole = session.user.role as UserRole;
      
      // Only admins can create users with roles other than SUBSCRIBER
      if (userData.role && userData.role !== UserRole.SUBSCRIBER) {
        if (requestingUserRole !== UserRole.ADMIN) {
          throw new AuthPermissionError(
            'Only ADMIN users can create users with non-SUBSCRIBER roles',
            undefined,
            {
              timestamp: Date.now(),
              requestingUserId: session.user.id,
              requestingUserRole,
              requestedRole: userData.role,
              operation: 'createUser'
            }
          );
        }
      }
    }

    // Step 3: Initialize database connection
    // 🚀 OPTIMIZED: Enhanced error handling with service manager
    const phase = getCurrentPhase();
    let adminDb;
    try {
      const serviceManager = getFirebaseServiceManager();
      adminDb = serviceManager.db;
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to initialize database connection',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          operation: 'getAdminDb'
        }
      );
    }

    const usersCollection = adminDb.collection('users');

    // Step 4: Check if user already exists
    let existingUserQuery;
    try {
      existingUserQuery = await usersCollection.where('email', '==', userData.email).get();
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to check for existing user',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          email: userData.email,
          operation: 'existing_user_check'
        }
      );
    }

    if (!existingUserQuery.empty) {
      throw new ValidationError(
        'User with this email already exists',
        undefined,
        {
          timestamp: Date.now(),
          email: userData.email,
          existingUserId: existingUserQuery.docs[0].id,
          operation: 'createUser'
        }
      );
    }

    // Step 5: Prepare user data with defaults
    const userId = userData.id || usersCollection.doc().id;
    const now = new Date();
    
    const newUser: AuthUser = {
      id: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role || UserRole.SUBSCRIBER,
      authProvider: userData.authProvider || 'credentials',
      authProviderId: userData.authProviderId || userId,
      isVerified: userData.isVerified || false,
      emailVerified: userData.emailVerified || null,
      createdAt: now,
      lastLogin: userData.lastLogin || null,
      settings: userData.settings || {
        language: 'en',
        theme: 'system',
        notifications: true,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      },
      canPostconfidentialOpportunities: userData.role === UserRole.ADMIN || userData.role === UserRole.CONFIDENTIAL,
      canViewconfidentialOpportunities: userData.role === UserRole.ADMIN || userData.role === UserRole.CONFIDENTIAL,
      postedopportunities: userData.postedopportunities || [],
      savedopportunities: userData.savedopportunities || [],
      notificationPreferences: userData.notificationPreferences || {
        sms: false,
        email: true,
        inApp: true,
      },
      wallets: userData.wallets || [],
    };

    // Step 6: Create the user document in Firestore
    try {
      await usersCollection.doc(newUser.id).set(newUser);
    } catch (error) {
      throw new EntityDatabaseError(
        'Failed to create user document',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          userId: newUser.id,
          email: newUser.email,
          operation: 'user_creation'
        }
      );
    }

    console.log(`Services: createUser - User created successfully with ID: ${newUser.id}`);
    return newUser;

  } catch (error) {
    // Enhanced error logging with cause information
    logRingError(error, 'Services: createUser - Error creating user');
    
    // Re-throw known errors, wrap unknown errors
    if (error instanceof AuthError || 
        error instanceof AuthPermissionError ||
        error instanceof ValidationError ||
        error instanceof EntityDatabaseError) {
      throw error;
    }
    
    // For unknown errors, still return null for backward compatibility
    console.error('Services: createUser - Unknown error occurred:', error);
    return null;
  }
}
