/**
 * PostgreSQL Adapter for Auth.js v5
 * 
 * This custom adapter routes authentication data through Ring Platform's
 * database abstraction layer (BackendSelector), which ensures that
 * all user data operations respect the DB_BACKEND_MODE config
 * and store information in the appropriate backend (PostgreSQL, Firebase, or Supabase).
 */

import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "next-auth/adapters"
import { cookies } from "next/headers" // TODO: When React 19/Next 16 enables native cookies API in all runtimes, codemod to new APIs for better SSR/edge cache interaction.
import { db } from "@/lib/database"
import type { DatabaseResult } from "@/lib/database/interfaces/IDatabaseService"
import {
  parseOAuthIntentRoleValue,
  OAUTH_INTENT_COOKIE_NAME,
  resolveOAuthIntentRole,
} from "@/features/auth/role-intent"
import {
  findUserByEmail,
  normalizeAuthEmail,
} from "@/features/auth/services/user-resolve"
import { UserRolesArray } from "@/features/auth/user-role"

// Represents a row from the user table with optional fields for profile information
type UserRow = Record<string, unknown> & {
  id: string
  email?: string
  emailVerified?: Date | null
  name?: string | null
  image?: string | null
}

// Throws an error if a DB command has failed. This avoids silent failures
function throwOnDbFailure<T>(result: DatabaseResult<T>, context: string): asserts result is { success: true; data: T } {
  if (!result.success) {
    const detail = result.error?.message ?? String(result.error ?? 'unknown error')
    if (result.metadata?.operation === 'initialize') {
      // Initialization-specific logging
      console.error('PostgreSQLAdapter: Database initialization failed:', result.error)
      throw new Error(`Database initialization failed: ${detail}`)
    }
    console.error(`PostgreSQLAdapter: ${context}:`, result.error)
    throw new Error(`${context}: ${detail}`)
  }
}

// Converts from a database user row to the AdapterUser format expected by Auth.js
function toAdapterUser(row: UserRow): AdapterUser {
  return {
    id: row.id,
    email: row.email ?? '',
    emailVerified: row.emailVerified ?? null,
    name: row.name ?? null,
    image: row.image ?? null,
  }
}

/**
 * The Ring Platform PostgreSQL Adapter
 * All CRUD operations are routed through the BackendSelector abstraction,
 * not direct SQL, to support multiple DB backends as determined at runtime.
 */
export function PostgreSQLAdapter(): Adapter {
  // Reads `role` either from a passed-in user, or an OAuth cookie fallback
  const readRequestedRole = async (user: AdapterUser) => {
    // Try to determine role from explicit user field (e.g., pre-parsed OAuth intent)
    const explicitRole = parseOAuthIntentRoleValue((user as AdapterUser & { role?: string }).role)
    if (explicitRole) return explicitRole

    // Otherwise, resolve from a temporary cookie set during OAuth login flow
    const cookieStore = await cookies()
    // TODO: When Next.js v16 exposes a natively typed cookie store in both app and server routes,
    // use new APIs for type safety and performance.
    return resolveOAuthIntentRole(cookieStore.get(OAUTH_INTENT_COOKIE_NAME)?.value)
  }

  // Implementation of Adapter API for Auth.js
  return {
    // Create a new User from OAuth registration or sign-up
    async createUser(user) {
      // Log for grant debugging
      console.log('PostgreSQLAdapter: Creating user via database abstraction:', user.email)
      try {
        // 1. Determine what role the user should have, based on OAuth intent or default
        const requestedRole = await readRequestedRole(user)
        const now = new Date()
        // 2. Assemble user data according to platform (including some platform-specific profile extensions)
        const userData = {
          id: user.id,
          globalUserId: user.id, // Needed for multi-tenant/legacy systems
          email: normalizeAuthEmail(user.email),
          emailVerified: user.emailVerified || null,
          name: user.name,
          image: user.image,
          role: requestedRole ?? UserRolesArray.visitor, // fallback to visitor role
          isVerified: !!user.emailVerified,
          createdAt: now,
          lastLogin: now,
          bio: '', // Platform extension: empty bio
          wallets: [], // Platform extension: social login may later attach wallets
          canPostConfidentialOpportunities: requestedRole === 'admin' || requestedRole === 'superadmin' || requestedRole === 'confidential',
          canViewConfidentialOpportunities: requestedRole === 'admin' || requestedRole === 'superadmin' || requestedRole === 'confidential',
          postedOpportunities: [],
          savedOpportunities: [],
          notificationPreferences: {
            email: true,
            inApp: true,
            sms: false,
          },
          settings: {
            language: 'en',
            theme: 'light',
            notifications: false,
          },
        }
        // 3. Insert user in requested backend, using platform abstraction layer
        const result = await db().createDoc('users', userData, { id: user.id })
        throwOnDbFailure(result, 'Failed to create user')
        if (!result.data) {
          // Safety: should never occur if backend works as intended
          throw new Error('Failed to create user: no document returned')
        }

        console.log('PostgreSQLAdapter: User created successfully:', result.data.id)
        // Transform and return required AdapterUser
        return toAdapterUser(result.data as UserRow)
      } catch (error) {
        // Log with adapter context
        console.error('PostgreSQLAdapter: Error creating user:', error)
        throw error
      }
    },

    // Retrieve a User by their unique ID
    async getUser(id) {
      console.log('PostgreSQLAdapter: Getting user by id:', id)
      try {
        const result = await db().readDoc<UserRow>('users', id)
        if (!result.success || !result.data) {
          console.log('PostgreSQLAdapter: User not found:', id)
          return null
        }
        return toAdapterUser(result.data)
      } catch (error) {
        console.error('PostgreSQLAdapter: Error getting user:', error)
        return null
      }
    },

    // Retrieve a User by their unique email address
    async getUserByEmail(email) {
      console.log('PostgreSQLAdapter: Getting user by email:', email)
      try {
        // Uses internal helper, which implements normalization and fallback search logic
        const row = await findUserByEmail(email)
        if (!row) {
          console.log('PostgreSQLAdapter: User not found by email:', email)
          return null
        }
        return toAdapterUser(row)
      } catch (error) {
        console.error('PostgreSQLAdapter: Error getting user by email:', error)
        return null
      }
    },

    // Given a linked OAuth account, find the user associated with it
    async getUserByAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Getting user by account:', { provider, providerAccountId })
      // Query the backend for matching account
      const accountResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'accounts',
        filters: [
          { field: 'provider', operator: '==', value: provider },
          { field: 'providerAccountId', operator: '==', value: providerAccountId },
        ],
        pagination: { limit: 1 },
      })

      if (!accountResult.success) {
        console.error('PostgreSQLAdapter: Account query failed:', accountResult.error?.message)
        return null
      }

      if (accountResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Account not found')
        return null
      }

      const account = accountResult.data[0]
      const userId = account.userId as string

      // Lookup the user itself
      const userResult = await db().readDoc<UserRow>('users', userId)

      if (!userResult.success || !userResult.data) {
        console.log('PostgreSQLAdapter: User not found for account')
        return null
      }

      return toAdapterUser(userResult.data)
    },

    // Update User profile fields (email, name, image, etc)
    async updateUser(user) {
      console.log('PostgreSQLAdapter: Updating user:', user.id)
      // Prepare an update shape that only includes updated fields
      const updateData: Record<string, unknown> = {}
      if (user.email !== undefined) updateData.email = user.email
      if (user.emailVerified !== undefined) updateData.emailVerified = user.emailVerified
      if (user.name !== undefined) updateData.name = user.name
      if (user.image !== undefined) updateData.image = user.image

      const result = await db().updateDoc<UserRow>('users', user.id, updateData)
      throwOnDbFailure(result, 'Failed to update user')
      if (!result.data) {
        throw new Error('Failed to update user: no document returned')
      }
      return toAdapterUser(result.data)
    },

    // Delete a user profile and all their persistent platform data
    async deleteUser(userId) {
      console.log('PostgreSQLAdapter: Deleting user:', userId)
      const result = await db().deleteDoc('users', userId)
      throwOnDbFailure(result, 'Failed to delete user')
      console.log('PostgreSQLAdapter: User deleted successfully:', userId)
      // TODO: Consider firing platform-wide profile deletion hooks (webhooks, cache invalidation) when Next.js 16+ adds new event APIs.
    },

    // Link a new external auth account (e.g., Google OAuth) to an existing user
    async linkAccount(account) {
      console.log('PostgreSQLAdapter: Linking account:', { provider: account.provider, userId: account.userId })
      const accountData = {
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
      }
      const result = await db().createDoc('accounts', accountData)
      throwOnDbFailure(result, 'Failed to link account')
      console.log('PostgreSQLAdapter: Account linked successfully')
      return accountData as AdapterAccount
    },

    // Unlink (remove) an external OAuth account from a user's profile
    async unlinkAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Unlinking account:', { provider, providerAccountId })
      // Find the associated account to delete it
      const accountResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'accounts',
        filters: [
          { field: 'provider', operator: '==', value: provider },
          { field: 'providerAccountId', operator: '==', value: providerAccountId },
        ],
        pagination: { limit: 1 },
      })

      if (!accountResult.success) {
        console.error('PostgreSQLAdapter: unlinkAccount query failed:', accountResult.error?.message)
        return
      }

      if (accountResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Account not found for unlinking')
        return
      }

      const account = accountResult.data[0]
      await db().deleteDoc('accounts', account.id)
      console.log('PostgreSQLAdapter: Account unlinked successfully')
    },

    // Create a session token mapping (for session-cookie based authentication)
    async createSession({ sessionToken, userId, expires }) {
      console.log('PostgreSQLAdapter: Creating session for user:', userId)
      const sessionData = {
        sessionToken,
        userId,
        expires,
      }
      const result = await db().createDoc('sessions', sessionData)
      throwOnDbFailure(result, 'Failed to create session')
      return sessionData as AdapterSession
    },

    // Given a session token (from an HTTP-only cookie), find session+user details
    async getSessionAndUser(sessionToken) {
      console.log('PostgreSQLAdapter: Getting session and user by token')
      const sessionResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success) {
        console.error('PostgreSQLAdapter: getSessionAndUser session query failed:', sessionResult.error?.message)
        return null
      }

      if (sessionResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Session not found')
        return null
      }

      const session = sessionResult.data[0]
      const userId = session.userId as string

      // Join with the actual user profile for SSR session hydration
      const userResult = await db().readDoc<UserRow>('users', userId)

      if (!userResult.success || !userResult.data) {
        console.log('PostgreSQLAdapter: User not found for session')
        return null
      }

      return {
        session: {
          sessionToken: session.sessionToken as string,
          userId: session.userId as string,
          expires: session.expires as Date,
        } as AdapterSession,
        user: toAdapterUser(userResult.data),
      }
    },

    // Update a session's user association or expiration if reissued
    async updateSession({ sessionToken, ...session }) {
      console.log('PostgreSQLAdapter: Updating session')
      // Find the existing session row
      const sessionResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || sessionResult.data.length === 0) {
        return null
      }

      const existingSession = sessionResult.data[0]
      // Update token metadata (e.g., prolong session)
      const result = await db().updateDoc('sessions', existingSession.id, session)

      if (!result.success || !result.data) {
        return null
      }

      const row = result.data as Record<string, unknown>
      return {
        sessionToken,
        userId: String(row.userId ?? session.userId ?? existingSession.userId),
        expires: (row.expires ?? session.expires) as Date,
      } as AdapterSession
    },

    // Remove a session from the backend (logout)
    async deleteSession(sessionToken) {
      console.log('PostgreSQLAdapter: Deleting session')
      // Find session by token. (Race condition safe, as only a single session per token)
      const sessionResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || sessionResult.data.length === 0) {
        return
      }

      const session = sessionResult.data[0]
      await db().deleteDoc('sessions', session.id)
    },

    // OTP/Email magic link handling (store a token for it, with expiry)
    async createVerificationToken({ identifier, expires, token }) {
      console.log('PostgreSQLAdapter: Creating verification token')
      const tokenData = {
        identifier,
        token,
        expires,
      }
      const result = await db().createDoc('verification_tokens', tokenData)
      throwOnDbFailure(result, 'Failed to create verification token')
      return tokenData as VerificationToken
    },

    // When a magic link is clicked, remove the verification token to prevent reuse,
    // and return the token content to complete validation.
    async useVerificationToken({ identifier, token }) {
      console.log('PostgreSQLAdapter: Using verification token')
      // Try to find the token by identifier and token string
      const tokenResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'verification_tokens',
        filters: [
          { field: 'identifier', operator: '==', value: identifier },
          { field: 'token', operator: '==', value: token },
        ],
        pagination: { limit: 1 },
      })

      if (!tokenResult.success || tokenResult.data.length === 0) {
        if (!tokenResult.success) {
          console.error('PostgreSQLAdapter: useVerificationToken query failed:', tokenResult.error?.message)
        }
        return null
      }

      const verificationToken = tokenResult.data[0]

      await db().deleteDoc('verification_tokens', verificationToken.id)

      return {
        identifier: verificationToken.identifier as string,
        token: verificationToken.token as string,
        expires: verificationToken.expires as Date,
      } as VerificationToken
    },
  }
}
