/**
 * Create User Service
 *
 * Creates new user in PostgreSQL database
 * Uses React 19 cache() for request deduplication
 */
// TODO: Consider using React 19's `cache()` to deduplicate identical user creation requests server-side and
// memoize findUserByEmail lookup during a single request cycle for efficiency
// TODO: Next.js 16 now supports async Server Actions with improved error propagation and streaming, allowing potential codemods for direct invocation of this service from the server using server actions

import { AuthUser } from '@/features/auth/types'
import { UserRolesArray } from '@/features/auth/user-role'
import { auth } from '@/auth'
import { assertKnownUserRole, hasConfidentialAccess, isPlatformAdmin } from '@/features/auth/user-role'
import { AuthError, AuthPermissionError, EntityDatabaseError, ValidationError, logRingError } from '@/lib/errors'
import { db } from '@/lib/database'
import { findUserByEmail, normalizeAuthEmail } from '@/features/auth/services/user-resolve';
import { DEFAULT_LOCALE } from '@/lib/locale-config';
import { getDefaultTheme } from '@/lib/ring-config-core';

/**
 * Create a new user in the DB, with authentication and role-based access control.
 * 
 * Implementation Steps:
 * 1. Authenticate request (if session present)
 * 2. Validate input
 * 3. Check for equivalent email in DB
 * 4. Compose full defaulted user object
 * 5. Insert into DB
 *
 * @param {Partial<AuthUser>} userData - Data for the new user
 * @returns {Promise<AuthUser | null>}
 */
export async function createUser(userData: Partial<AuthUser>): Promise<AuthUser | null> {
  try {
    console.log('Services: createUser - Starting user creation process...');

    // Step 1: Validate required fields, fail fast and informatively
    if (!userData.email) {
      // A ValidationError is thrown if email is missing
      throw new ValidationError('Email is required for user creation', undefined, {
        timestamp: Date.now(),
        providedData: userData,
        missingField: 'email',
        operation: 'createUser'
      });
    }

    if (!userData.name) {
      // Name is also mandatory for user creation
      throw new ValidationError('Name is required for user creation', undefined, {
        timestamp: Date.now(),
        providedData: userData,
        missingField: 'name',
        operation: 'createUser'
      });
    }

    // Step 2: Optionally authenticate current session user for admin-based creation
    // NOTE: In Next.js 16, you might migrate this to a server action for improved security
    const session = await auth();

    // If this creation is being performed while logged in, apply RBAC validation
    if (session && session.user) {
      // Normalize and check requesting user's role
      const requestingUserRole = assertKnownUserRole(session.user.role);

      // Only platform admins can create users with non-default roles (other than SUBSCRIBER)
      if (userData.role && userData.role !== UserRolesArray.subscriber) {
        if (!isPlatformAdmin(requestingUserRole)) {
          throw new AuthPermissionError(
            'Only admin users can create users with non-SUBSCRIBER roles',
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

    // Step 3: Normalize email and check if user already exists in DB
    const email = normalizeAuthEmail(userData.email);
    try {
      // TODO (React 19): Wrap this lookup into cache() to deduplicate during request batch
      const existing = await findUserByEmail(email);
      if (existing) {
        // Fail if a user with this email already exists
        throw new ValidationError(
          'User with this email already exists',
          undefined,
          {
            timestamp: Date.now(),
            email,
            existingUserId: existing.id,
            operation: 'createUser'
          }
        );
      }
    } catch (error) {
      // Surface ValidationError directly, otherwise wrap DB errors
      if (error instanceof ValidationError) throw error;
      throw new EntityDatabaseError(
        'Failed to check for existing user',
        error instanceof Error ? error : new Error(String(error)),
        {
          timestamp: Date.now(),
          email,
          operation: 'existing_user_check'
        }
      );
    }

    // Step 4: Generate user ID and merge with defaults
    // TODO: Move ID generation to a utility that guarantees uniqueness (e.g. use nanoid or database ID)
    const userId = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // STUB: Replace with robust id generation
    const now = new Date();

    // Compose a full AuthUser object with sensible defaults and received (partial) input
    const newUser: AuthUser = {
      id: userId,
      globalUserId: userData.globalUserId || userId,
      email,
      name: userData.name,
      role: userData.role || UserRolesArray.subscriber,
      authProvider: userData.authProvider || 'credentials',
      authProviderId: userData.authProviderId || userId,
      isVerified: userData.isVerified || false,
      emailVerified: userData.emailVerified || null,
      createdAt: now,
      lastLogin: userData.lastLogin || null,
      accountStatus: 'ACTIVE', // New users default to active
      settings: userData.settings || {
        language: DEFAULT_LOCALE,
        theme: getDefaultTheme(),
        notifications: true,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      },
      canPostconfidentialOpportunities: hasConfidentialAccess(userData.role),
      canViewconfidentialOpportunities: hasConfidentialAccess(userData.role),
      postedopportunities: userData.postedopportunities || [],
      savedopportunities: userData.savedopportunities || [],
      notificationPreferences: userData.notificationPreferences || {
        sms: false,
        email: true,
        inApp: true,
      },
      wallets: userData.wallets || [],
    };

    // Step 5: Insert new user document into database
    try {
      // NOTE: db().createDoc should atomically insert the new user
      // STUB: Validate that db().createDoc handles unique index violation and error surfacing gracefully
      // TODO: Replace with useDatabaseMutation (if Next.js 16 Polyfills/provides) for native data mutation reliability
      const createResult = await db().createDoc('users', newUser as unknown as Record<string, unknown>, { id: newUser.id });

      // Verify insertion was entirely successful
      if (!createResult.success) {
        throw new EntityDatabaseError(
          'Failed to create user document',
          createResult.error || new Error('Unknown error'),
          {
            timestamp: Date.now(),
            userId: newUser.id,
            email: newUser.email,
            operation: 'user_creation'
          }
        );
      }
    } catch (error) {
      // Rethrow database errors or surface other lower-level errors as standardized EntityDatabaseError
      if (error instanceof EntityDatabaseError) throw error;
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

    // Success: User was created and inserted
    console.log(`Services: createUser - User created successfully with ID: ${newUser.id}`);
    return newUser;

  } catch (error) {
    // Comprehensive error logging--logs the stack/cause as permitted by error shape
    logRingError(error, 'Services: createUser - Error creating user');

    // Propagate specific expected errors to be handled by upper layers
    if (
      error instanceof AuthError ||
      error instanceof AuthPermissionError ||
      error instanceof ValidationError ||
      error instanceof EntityDatabaseError
    ) {
      throw error;
    }

    // Unexpected: Log and fallback return null for legacy compatibility
    console.error('Services: createUser - Unknown error occurred:', error);
    return null;
  }
}
