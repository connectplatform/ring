/**
 * Get User Profile Service
 *
 * Retrieves user profile from PostgreSQL database
 * Uses React 19 cache() for request deduplication
 * 
 * - Authenticates current user session
 * - Fetches user row by userId from the database
 * - Assembles and returns normalized AuthUser object
 * - Safely handles errors and logs with context
 * 
 * // TODO: In Next.js 16+ and React 19, prefer using `cache` for all server functions
 *        to deduplicate identical concurrent requests, as done here. 
 *        Consider moving validation/auth logic to a middleware if reused.
 *        Prefer structured errors for better error boundary handling.
 */

import { AuthUser, NotificationPreferences, UserSettings, Wallet } from '@/features/auth/types'
import { UserRolesArray } from '@/features/auth/user-role'
import type { UserRow } from '@/features/auth/lib/user-row'
import { normalizeAccountStatus } from '@/features/auth/lib/account-status'
import { cache } from 'react'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { getDefaultTheme } from '@/lib/ring-config-core'
import { logRingError } from '@/lib/errors'

// --- Main Service (server function, memoized by React 19 cache) ---
export const getUserProfile = cache(
  async (userId: string): Promise<AuthUser | null> => {
    // Start of main logic
    console.log('getUserProfile: Starting for user', userId) // Trace request

    try {
      // --- Step 1: Authenticate the current session/user ---
      const session = await auth() // Await authentication logic
      if (!session || !session.user) {
        // User is not authenticated
        throw new Error('Unauthorized')
      }

      console.log('getUserProfile: Authenticated') // Auth success log

      // --- Step 2: Fetch user data from DB using provided userId ---
      // NOTE: Expects database service to provide a consistent .findDocById API
      const result = await db().findDocById<UserRow>('users', userId)

      // If user not found or DB error, return null
      if (!result.success || !result.data) {
        console.log('getUserProfile: User not found')
        return null
      }

      const data = result.data // Extract user row

      // --- Step 3: Construct the AuthUser profile with normalized fields ---
      const userProfile: AuthUser = {
        // Required IDs and identity
        id: userId,
        globalUserId: data.global_user_id || userId, // Fallback for global_user_id

        // Main contact info
        email: data.email,

        // Email verification date or null if not verified
        emailVerified: data.emailVerified ? new Date(data.emailVerified) : null,

        // Name and display photoURL, null fallback for missing
        name: data.name || null,
        role: data.role as UserRolesArray | undefined, // User role normalized to type
        photoURL: data.photoURL || null,

        // Wallet connections, safe fallback to empty array
        wallets: (data.wallets as Wallet[] | undefined) ?? [],

        // Authentication provider details (e.g., Google, Github, etc)
        authProvider: data.authProvider as string | undefined,
        authProviderId: data.authProviderId as string | undefined,

        // Boolean user status, with dual key fallback
        isVerified: Boolean(
          data.isVerified ?? data.is_verified ?? false
        ),

        // Timestamps, fallback to current if missing (defensive)
        createdAt: new Date(
          (data.createdAt as string | number | Date) || Date.now()
        ),
        lastLogin: new Date(
          (data.lastLogin as string | number | Date) || Date.now()
        ),

        // Normalized account status using helper — limited to enums
        accountStatus: normalizeAccountStatus(
          (data.account_status as string | undefined) ?? (data.accountStatus as string | undefined)
        ) as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',

        // User bio, optional
        bio: data.bio as string | undefined,

        // Feature flags for confidential opportunities permissions
        canPostconfidentialOpportunities: data.canPostconfidentialOpportunities as boolean | undefined,
        canViewconfidentialOpportunities: data.canViewconfidentialOpportunities as boolean | undefined,

        // Opportunity lists, safe fallback to empty arrays to avoid runtime errors
        postedopportunities: Array.isArray(data.postedopportunities)
          ? data.postedopportunities
          : [],
        savedopportunities: Array.isArray(data.savedopportunities)
          ? data.savedopportunities
          : [],

        // Nonce and expiration for possible token/session logic
        nonce: data.nonce as string | undefined,
        nonceExpires: data.nonceExpires as number | undefined,

        // Notification preferences, fallback to default values
        notificationPreferences:
          (data.notificationPreferences as NotificationPreferences) || {
            email: true,
            inApp: true,
            sms: false,
          },

        // Settings, fallback to sensible defaults
        settings:
          (data.settings as UserSettings | undefined) || {
            language: DEFAULT_LOCALE,
            theme: getDefaultTheme(),
            notifications: true,
            notificationPreferences: {
              email: true,
              inApp: true,
              sms: false,
            },
          },
      }

      // TODO: When using server actions, consider extracting error boundaries to catch errors higher up for better UX (React 19 server error boundaries).
      // TODO: Explore replacing console logs with structured serverLogger for production readiness.

      return userProfile
    } catch (error) {
      // --- Step 4: Error logging and re-throw ---
      logRingError(error, 'Services: getUserProfile - Error') // Log with context
      if (error instanceof Error) {
        throw error // Re-throw actual error for upstream handling
      }
      throw new Error('Unknown error occurred while fetching user profile') // Fallback for non-Error throws
    }
  }
)