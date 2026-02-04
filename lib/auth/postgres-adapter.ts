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
import { getDatabaseService } from "@/lib/database/DatabaseService"

/**
 * Create a PostgreSQL adapter that uses Ring Platform's database abstraction
 * This adapter will route all operations through BackendSelector which
 * respects the configured backend (PostgreSQL/Firebase/Hybrid)
 */
export function PostgreSQLAdapter(): Adapter {
  // Get database service and ensure it's initialized
  const db = getDatabaseService()
  
  // Auto-initialize database service on first use
  let initPromise: Promise<void> | null = null
  const ensureInitialized = async () => {
    if (!initPromise) {
      initPromise = db.initialize().then(result => {
        if (result.success) {
          console.log('PostgreSQLAdapter: Database initialized successfully')
        } else {
          console.error('PostgreSQLAdapter: Database initialization failed:', result.error)
          throw new Error('Database initialization failed')
        }
      })
    }
    return initPromise
  }

  return {
    async createUser(user) {
      console.log('PostgreSQLAdapter: Creating user via database abstraction:', user.email)
      
      try {
        // Ensure database is initialized before operations
        await ensureInitialized()
        
        const now = new Date()
        const userData = {
        email: user.email,
        emailVerified: user.emailVerified || null,
        name: user.name,
        image: user.image,
        role: 'SUBSCRIBER',
        isVerified: !!user.emailVerified,
        createdAt: now,
        lastLogin: now,
        bio: '',
        wallets: [],
        canPostConfidentialOpportunities: false,
        canViewConfidentialOpportunities: false,
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

        const result = await db.create('users', userData, { id: user.id })

        if (!result.success || !result.data) {
          console.error('PostgreSQLAdapter: Failed to create user:', result.error)
          throw new Error(`Failed to create user: ${result.error?.message}`)
        }

        console.log('PostgreSQLAdapter: User created successfully:', result.data.id)

        return {
          id: result.data.id,
          email: result.data.data.email,
          emailVerified: result.data.data.emailVerified,
          name: result.data.data.name,
          image: result.data.data.image,
        }
      } catch (error) {
        console.error('PostgreSQLAdapter: Error creating user:', error)
        // Re-throw to let Auth.js handle it
        throw error
      }
    },

    async getUser(id) {
      console.log('PostgreSQLAdapter: Getting user by id:', id)
      
      try {
        await ensureInitialized()
        const result = await db.read('users', id)

        if (!result.success || !result.data) {
          console.log('PostgreSQLAdapter: User not found:', id)
          return null
        }

        const user = result.data.data
        return {
          id: result.data.id,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          image: user.image,
        }
      } catch (error) {
        console.error('PostgreSQLAdapter: Error getting user:', error)
        return null
      }
    },

    async getUserByEmail(email) {
      console.log('PostgreSQLAdapter: Getting user by email:', email)
      
      try {
        await ensureInitialized()
        const result = await db.query({
          collection: 'users',
          filters: [{ field: 'email', operator: '==', value: email }],
          pagination: { limit: 1 },
        })

        if (!result.success || !result.data || result.data.length === 0) {
          console.log('PostgreSQLAdapter: User not found by email:', email)
          return null
        }

        const userData = result.data[0]
        return {
          id: userData.id,
          email: userData.data.email,
          emailVerified: userData.data.emailVerified,
          name: userData.data.name,
          image: userData.data.image,
        }
      } catch (error) {
        console.error('PostgreSQLAdapter: Error getting user by email:', error)
        return null
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Getting user by account:', { provider, providerAccountId })
      
      // Query accounts collection to find the account
      const accountResult = await db.query({
        collection: 'accounts',
        filters: [
          { field: 'provider', operator: '==', value: provider },
          { field: 'providerAccountId', operator: '==', value: providerAccountId },
        ],
        pagination: { limit: 1 },
      })

      if (!accountResult.success || !accountResult.data || accountResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Account not found')
        return null
      }

      const account = accountResult.data[0]
      const userId = account.data.userId

      // Get the user
      const userResult = await db.read('users', userId)

      if (!userResult.success || !userResult.data) {
        console.log('PostgreSQLAdapter: User not found for account')
        return null
      }

      const user = userResult.data.data
      return {
        id: userResult.data.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      }
    },

    async updateUser(user) {
      console.log('PostgreSQLAdapter: Updating user:', user.id)
      
      const updateData: any = {}
      if (user.email !== undefined) updateData.email = user.email
      if (user.emailVerified !== undefined) updateData.emailVerified = user.emailVerified
      if (user.name !== undefined) updateData.name = user.name
      if (user.image !== undefined) updateData.image = user.image

      const result = await db.update('users', user.id, updateData)

      if (!result.success || !result.data) {
        console.error('PostgreSQLAdapter: Failed to update user:', result.error)
        throw new Error(`Failed to update user: ${result.error?.message}`)
      }

      const userData = result.data.data
      return {
        id: result.data.id,
        email: userData.email,
        emailVerified: userData.emailVerified,
        name: userData.name,
        image: userData.image,
      }
    },

    async deleteUser(userId) {
      console.log('PostgreSQLAdapter: Deleting user:', userId)
      
      const result = await db.delete('users', userId)

      if (!result.success) {
        console.error('PostgreSQLAdapter: Failed to delete user:', result.error)
        throw new Error(`Failed to delete user: ${result.error?.message}`)
      }

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

      const result = await db.create('accounts', accountData)

      if (!result.success || !result.data) {
        console.error('PostgreSQLAdapter: Failed to link account:', result.error)
        throw new Error(`Failed to link account: ${result.error?.message}`)
      }

      console.log('PostgreSQLAdapter: Account linked successfully')
      return accountData as AdapterAccount
    },

    async unlinkAccount({ providerAccountId, provider }) {
      console.log('PostgreSQLAdapter: Unlinking account:', { provider, providerAccountId })
      
      // Find the account first
      const accountResult = await db.query({
        collection: 'accounts',
        filters: [
          { field: 'provider', operator: '==', value: provider },
          { field: 'providerAccountId', operator: '==', value: providerAccountId },
        ],
        pagination: { limit: 1 },
      })

      if (!accountResult.success || !accountResult.data || accountResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Account not found for unlinking')
        return
      }

      const account = accountResult.data[0]
      await db.delete('accounts', account.id)
      console.log('PostgreSQLAdapter: Account unlinked successfully')
    },

    async createSession({ sessionToken, userId, expires }) {
      console.log('PostgreSQLAdapter: Creating session for user:', userId)
      
      const sessionData = {
        sessionToken,
        userId,
        expires,
      }

      const result = await db.create('sessions', sessionData)

      if (!result.success || !result.data) {
        console.error('PostgreSQLAdapter: Failed to create session:', result.error)
        throw new Error(`Failed to create session: ${result.error?.message}`)
      }

      return sessionData as AdapterSession
    },

    async getSessionAndUser(sessionToken) {
      console.log('PostgreSQLAdapter: Getting session and user by token')
      
      const sessionResult = await db.query({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
        console.log('PostgreSQLAdapter: Session not found')
        return null
      }

      const session = sessionResult.data[0].data
      const userId = session.userId

      const userResult = await db.read('users', userId)

      if (!userResult.success || !userResult.data) {
        console.log('PostgreSQLAdapter: User not found for session')
        return null
      }

      const user = userResult.data.data

      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        } as AdapterSession,
        user: {
          id: userResult.data.id,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          image: user.image,
        } as AdapterUser,
      }
    },

    async updateSession({ sessionToken, ...session }) {
      console.log('PostgreSQLAdapter: Updating session')
      
      const sessionResult = await db.query({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
        return null
      }

      const existingSession = sessionResult.data[0]
      const result = await db.update('sessions', existingSession.id, session)

      if (!result.success || !result.data) {
        return null
      }

      return result.data.data as AdapterSession
    },

    async deleteSession(sessionToken) {
      console.log('PostgreSQLAdapter: Deleting session')
      
      const sessionResult = await db.query({
        collection: 'sessions',
        filters: [{ field: 'sessionToken', operator: '==', value: sessionToken }],
        pagination: { limit: 1 },
      })

      if (!sessionResult.success || !sessionResult.data || sessionResult.data.length === 0) {
        return
      }

      const session = sessionResult.data[0]
      await db.delete('sessions', session.id)
    },

    async createVerificationToken({ identifier, expires, token }) {
      console.log('PostgreSQLAdapter: Creating verification token')
      
      const tokenData = {
        identifier,
        token,
        expires,
      }

      const result = await db.create('verification_tokens', tokenData)

      if (!result.success || !result.data) {
        console.error('PostgreSQLAdapter: Failed to create verification token:', result.error)
        throw new Error(`Failed to create verification token: ${result.error?.message}`)
      }

      return tokenData as VerificationToken
    },

    async useVerificationToken({ identifier, token }) {
      console.log('PostgreSQLAdapter: Using verification token')
      
      const tokenResult = await db.query({
        collection: 'verification_tokens',
        filters: [
          { field: 'identifier', operator: '==', value: identifier },
          { field: 'token', operator: '==', value: token },
        ],
        pagination: { limit: 1 },
      })

      if (!tokenResult.success || !tokenResult.data || tokenResult.data.length === 0) {
        return null
      }

      const verificationToken = tokenResult.data[0]
      
      // Delete the token after use
      await db.delete('verification_tokens', verificationToken.id)

      return verificationToken.data as VerificationToken
    },
  }
}

