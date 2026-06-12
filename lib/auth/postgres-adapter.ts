/**
 * PostgreSQL Adapter for Auth.js v5
 * 
 * Custom adapter that routes authentication data through Ring Platform's
 * database abstraction layer (BackendSelector).
 * 
 * This ensures all user data respects the DB_BACKEND_MODE configuration
 * and is stored in the appropriate backend (PostgreSQL, Firebase, or Supabase).
 */

import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from "next-auth/adapters"
import { cookies } from "next/headers"
import { db } from "@/lib/database"
import type { DatabaseResult } from "@/lib/database/interfaces/IDatabaseService"
import {
  DEFAULT_USER_ROLE,
  OAUTH_INTENT_COOKIE_NAME,
  resolveOAuthIntentRole,
  normalizeUserRole,
} from "@/features/auth/role-intent"

type UserRow = Record<string, unknown> & {
  id: string
  email?: string
  emailVerified?: Date | null
  name?: string | null
  image?: string | null
}

function throwOnDbFailure<T>(result: DatabaseResult<T>, context: string): asserts result is { success: true; data: T } {
  if (!result.success) {
    const detail = result.error?.message ?? String(result.error ?? 'unknown error')
    if (result.metadata?.operation === 'initialize') {
      console.error('PostgreSQLAdapter: Database initialization failed:', result.error)
      throw new Error(`Database initialization failed: ${detail}`)
    }
    console.error(`PostgreSQLAdapter: ${context}:`, result.error)
    throw new Error(`${context}: ${detail}`)
  }
}

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
 * Create a PostgreSQL adapter that uses Ring Platform's database abstraction
 * This adapter will route all operations through BackendSelector which
 * respects the configured backend (PostgreSQL/Firebase/Hybrid)
 */
export function PostgreSQLAdapter(): Adapter {
  const readRequestedRole = async (user: AdapterUser) => {
    const explicitRole = normalizeUserRole((user as AdapterUser & { role?: string }).role)
    if (explicitRole) return explicitRole

    const cookieStore = await cookies()
    return resolveOAuthIntentRole(cookieStore.get(OAUTH_INTENT_COOKIE_NAME)?.value)
  }

  return {
    async createUser(user) {
      console.log('PostgreSQLAdapter: Creating user via database abstraction:', user.email)
      
      try {
        const requestedRole = await readRequestedRole(user)
        const now = new Date()
        const userData = {
        email: user.email,
        emailVerified: user.emailVerified || null,
        name: user.name,
        image: user.image,
        role: requestedRole ?? DEFAULT_USER_ROLE,
        isVerified: !!user.emailVerified,
        createdAt: now,
        lastLogin: now,
        bio: '',
        wallets: [],
        canPostConfidentialOpportunities: requestedRole === 'ADMIN' || requestedRole === 'CONFIDENTIAL',
        canViewConfidentialOpportunities: requestedRole === 'ADMIN' || requestedRole === 'CONFIDENTIAL',
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

        const result = await db().createDoc('users', userData, { id: user.id })
        throwOnDbFailure(result, 'Failed to create user')
        if (!result.data) {
          throw new Error('Failed to create user: no document returned')
        }

        console.log('PostgreSQLAdapter: User created successfully:', result.data.id)

        return toAdapterUser(result.data as UserRow)
      } catch (error) {
        console.error('PostgreSQLAdapter: Error creating user:', error)
        throw error
      }
    },

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

    async getUserByEmail(email) {
      console.log('PostgreSQLAdapter: Getting user by email:', email)
      
      try {
        const result = await db().queryDocs<UserRow>({
          collection: 'users',
          filters: [{ field: 'email', operator: '==', value: email }],
          pagination: { limit: 1 },
        })

        if (!result.success || result.data.length === 0) {
          console.log('PostgreSQLAdapter: User not found by email:', email)
          return null
        }

        return toAdapterUser(result.data[0])
      } catch (error) {
        console.error('PostgreSQLAdapter: Error getting user by email:', error)
        return null
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Getting user by account:', { provider, providerAccountId })
      
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

      const userResult = await db().readDoc<UserRow>('users', userId)

      if (!userResult.success || !userResult.data) {
        console.log('PostgreSQLAdapter: User not found for account')
        return null
      }

      return toAdapterUser(userResult.data)
    },

    async updateUser(user) {
      console.log('PostgreSQLAdapter: Updating user:', user.id)
      
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

    async deleteUser(userId) {
      console.log('PostgreSQLAdapter: Deleting user:', userId)
      
      const result = await db().deleteDoc('users', userId)
      throwOnDbFailure(result, 'Failed to delete user')

      console.log('PostgreSQLAdapter: User deleted successfully:', userId)
    },

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

    async unlinkAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Unlinking account:', { provider, providerAccountId })
      
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

    async updateSession({ sessionToken, ...session }) {
      console.log('PostgreSQLAdapter: Updating session')
      
      const sessionResult = await db().queryDocs<Record<string, unknown> & { id: string }>({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || sessionResult.data.length === 0) {
        return null
      }

      const existingSession = sessionResult.data[0]
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

    async deleteSession(sessionToken) {
      console.log('PostgreSQLAdapter: Deleting session')
      
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

    async useVerificationToken({ identifier, token }) {
      console.log('PostgreSQLAdapter: Using verification token')
      
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
