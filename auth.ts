import NextAuth from "next-auth"
import type { Session } from "next-auth"
import { getAuthAdapter } from "@/lib/auth-adapter-singleton"
import { getAdminDb } from "@/lib/firebase-admin.server"
import { db } from "@/lib/database"
import authConfig from "./auth.config"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import Resend from "next-auth/providers/resend"
import {
  normalizeWalletStorageId,
  verifyWalletNonceSignature,
} from "@/features/wallet/services/verify-wallet-signature"
import { OAuth2Client } from 'google-auth-library'
import { generateInternalJWT } from "@/lib/auth/generate-jwt"
import {
  UserRole,
  type AuthUser,
  type Wallet,
  type UserSettings,
  type NotificationPreferences,
} from "@/features/auth/types"
import { normalizeUserRole } from "@/features/auth/user-role"
import { ensureWallet } from "@/features/wallet/services/ensure-wallet"
import { userMigrationService } from "@/features/auth/services/user-migration"
import { shouldSkipDatabaseConnect } from "@/lib/build-cache/phase-detector"
import {
  getGoogleIdTokenAudiences,
  getGoogleOAuthClientId,
} from "@/lib/auth/google-oauth-client"
import { getMcpActor } from "@/lib/auth/mcp-actor-context"

const googleOAuthClientId = getGoogleOAuthClientId()

// Initialize Google Auth client for ID token verification (server-side only)
const googleAuthClient = new OAuth2Client(googleOAuthClientId)

// Logging utility - only logs when explicitly requested and not during build
const shouldLogAuth = () => {
  // Never log during build process
  if (process.env.npm_lifecycle_event === 'build' || process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.DB_DEBUG === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.DB_DEBUG !== 'false');
};

const authLog = (...args: any[]) => {
  if (shouldLogAuth()) {
    console.log(...args);
  }
};

/**
 * Auth.js v5 Server-Side Configuration
 * Main authentication configuration with database adapter
 * This is used in server components and API routes
 * 
 * Adapter selection respects DB_BACKEND_MODE environment variable:
 * - k8s-postgres-fcm: Uses PostgreSQL adapter (routes through BackendSelector)
 * - firebase-full: Uses Firebase adapter (Firestore)
 * - supabase-fcm: Uses PostgreSQL adapter (Supabase connection)
 */

// Get cached auth adapter (singleton pattern for performance)
const authAdapter = getAuthAdapter()

// Import backend mode utilities for conditional logic
import { shouldUseFirebaseForDatabase } from './lib/database/backend-mode-config'
const useFirebase = shouldUseFirebaseForDatabase()
const usePostgreSQL = !useFirebase

// Determine if we should include Resend based on adapter availability
const hasAdapter = !!authAdapter
const hasResendKey = process.env.AUTH_RESEND_KEY;

// During `next build`, getAuthAdapter() intentionally returns null (no DB) — do not warn.
if (!hasAdapter && hasResendKey && !shouldSkipDatabaseConnect()) {
  console.warn(
    "AUTH_RESEND_KEY is set but no Auth.js database adapter is available. Magic link authentication will be disabled.",
  )
}
if (hasAdapter && !hasResendKey && !shouldSkipDatabaseConnect()) {
  console.info(
    "AUTH_RESEND_KEY not set. Magic link authentication will be disabled. Set AUTH_RESEND_KEY to enable email authentication.",
  )
}

const nextAuthApp = NextAuth({
  ...authConfig,
  // Use configured adapter (PostgreSQL or Firebase based on DB_HYBRID_MODE)
  ...(hasAdapter && { adapter: authAdapter }),
  session: { 
    strategy: "jwt", // Use JWT for better edge compatibility and reliability
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  // Auth.js v5 required configuration
  trustHost: true, // Required for deployment on Vercel
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    }
  },
  providers: [
    // Magic Link Email Authentication (requires adapter for token storage)
    // Only add if we have both an adapter and Resend API key
    ...(hasAdapter && hasResendKey ? [
      Resend({
        // Auth.js v5 automatically uses AUTH_RESEND_KEY
        from: process.env.AUTH_RESEND_FROM || "noreply@ring-platform.org",
      })
    ] : []),
    
    // Google OAuth (Traditional flow - kept for compatibility)
    GoogleProvider({
      // Auth.js v5 automatically uses AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
      authorization: {
        params: {
          response_type: "code",
        },
      },
      // Auth.js v5 stricter OAuth compliance - ensure proper PKCE and state handling
      checks: ["pkce", "state"],
      // Explicitly set wellKnown endpoint for better reliability
      wellKnown: "https://accounts.google.com/.well-known/openid-configuration",
    }),
    
    // Google Identity Services (GIS) JWT credentials handler
    // Receives JWT credential from client-side GIS button
    // Verified server-side in signIn callback below
    CredentialsProvider({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: {
        credential: { type: 'text' },
      },
      async authorize(credentials) {
        // Minimal validation - full verification happens in signIn callback
        if (!credentials?.credential) {
          authLog('🟡 No GIS JWT credential provided')
          return null
        }

        authLog('🟡 GIS JWT provider - passing credential for server verification')
        authLog('🟡 JWT length:', (credentials.credential as string).length)

        // Return placeholder user with JWT embedded in email field
        // This is how we pass the JWT to the signIn callback
        return {
          id: 'gis-jwt-pending',
          email: credentials.credential as string, // Store JWT credential here for signIn callback
          name: 'GIS User',
          image: null,
          role: UserRole.SUBSCRIBER,
        }
      },
    }),
    
    // Apple OAuth
    AppleProvider({
      // Auth.js v5 automatically uses AUTH_APPLE_ID and AUTH_APPLE_SECRET
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
    
    // Crypto Wallet Authentication (MetaMask, WalletConnect, etc)
    CredentialsProvider({
      id: "crypto-wallet",
      name: "Crypto Wallet",
      credentials: {
        walletAddress: { label: "Wallet Address", type: "text" },
        signedNonce: { label: "Signed Nonce", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.walletAddress || !credentials?.signedNonce) return null

        const walletAddress = String(credentials.walletAddress)
        const signedNonce = String(credentials.signedNonce)

        try {
          const storageId = normalizeWalletStorageId(walletAddress)
          let userData: Record<string, unknown> | null = null

          if (usePostgreSQL) {
            const userResult = await db().readDoc<Record<string, unknown>>('users', storageId)
            if (!userResult.success) {
              if (userResult.metadata?.operation === 'initialize') {
                authLog("Crypto wallet auth: database init failed", userResult.error)
              }
              return null
            }
            if (userResult.data) {
              userData = userResult.data
            }
          } else if (useFirebase) {
            const db = getAdminDb()
            if (!db) {
              throw new Error("Firestore instance is not available")
            }
            const userDoc = await db.collection("users").doc(storageId).get()
            userData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : null
          }

          const nonce = userData?.nonce
          if (!nonce || typeof nonce !== "string") return null

          const nonceExpires = userData?.nonceExpires
          if (typeof nonceExpires === "number" && nonceExpires < Date.now()) return null

          const valid = await verifyWalletNonceSignature({
            walletAddress,
            nonce,
            signature: signedNonce,
          })
          if (!valid) return null

          const clearedNonce = {
            ...userData,
            nonce: null,
            nonceExpires: null,
            lastLogin: new Date(),
          }

          if (usePostgreSQL) {
            await db().updateDoc('users', storageId, clearedNonce)
          } else if (useFirebase) {
            const db = getAdminDb()
            if (db) {
              await db.collection("users").doc(storageId).update({
                nonce: null,
                nonceExpires: null,
                lastLogin: new Date(),
              })
            }
          }

          const now = new Date()

          return {
            id: storageId,
            email: String(userData?.email || ""),
            name: (userData?.name as string | null) || null,
            image: (userData?.photoURL as string | null) || (userData?.image as string | null) || null,
            role: (userData?.role as UserRole) || UserRole.SUBSCRIBER,
            isVerified: !!userData?.isVerified,
            createdAt: (userData?.createdAt as Date) || now,
            lastLogin: now,
          }
        } catch (error) {
          console.error("Crypto wallet auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, trigger }) {
      // Only log on significant events in development or when explicitly requested
      if (process.env.NODE_ENV === 'development' || process.env.AUTH_DEBUG === 'true') {
        if (trigger === 'update' || (user && account)) {
          authLog('JWT callback:', { trigger, hasUser: !!user, userId: user?.id })
        }
      }

      // Only fetch fresh role data when necessary - optimize JWT caching
      const needsUserData = trigger === 'update' ||
                           (user && account) ||
                           (user && !token.name) ||
                           (token.userId && !token.role) // Only fetch if role not cached

      if (needsUserData) {
        if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
          authLog('Fetching fresh user data for userId:', token.userId || user?.id)
        }
        
        try {
          if (usePostgreSQL) {
            const userId = (token.userId as string) || user?.id
            
            if (userId) {
              if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
                authLog('Looking up user in PostgreSQL via BackendSelector:', userId)
              }
              const result = await db().readDoc<Record<string, unknown>>('users', userId)

              if (!result.success) {
                if (result.metadata?.operation === 'initialize') {
                  authLog('Database initialization failed in JWT callback:', result.error)
                }
                return token
              }

              if (result.data) {
                const userData = result.data
                if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
                  authLog('Found user data in PostgreSQL:', { name: userData?.name, email: userData?.email, role: userData?.role })
                }
                
                token.username = userData?.username
                token.phoneNumber = userData?.phoneNumber
                token.bio = userData?.bio
                token.organization = userData?.organization
                token.position = userData?.position
                token.photoURL = userData?.photoURL || userData?.image
                token.role = userData?.role ?? UserRole.SUBSCRIBER
                token.isVerified = userData?.isVerified ?? false
              } else {
                authLog('User document not found in PostgreSQL for ID:', userId)
              }
            }
          } else if (useFirebase) {
            // Fetch from Firebase (legacy mode)
            const db = getAdminDb()
            if (db && (token.userId || user?.id)) {
              const userId = (token.userId as string) || user?.id
              console.log('Looking up user document in Firebase for ID:', userId)
              const userDoc = await db.collection("users").doc(userId).get()

              if (userDoc.exists) {
                const userData = userDoc.data()
                console.log('Found user data in Firebase:', { name: userData?.name, email: userData?.email, role: userData?.role })

                token.username = userData?.username
                token.phoneNumber = userData?.phoneNumber
                token.bio = userData?.bio
                token.organization = userData?.organization
                token.position = userData?.position
                token.photoURL = userData?.photoURL
                token.role = userData?.role ?? UserRole.SUBSCRIBER
                token.isVerified = userData?.isVerified ?? false
              } else {
                console.log('User document not found in Firebase for ID:', userId)
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data in JWT callback:', error)
        }
      }

      if (user) {
        token.userId = user.id
        token.role = token.role || (user as any).role || UserRole.SUBSCRIBER
        token.isVerified = (user as any).isVerified ?? false
        token.username = (user as any).username
        token.phoneNumber = (user as any).phoneNumber
        token.bio = (user as any).bio
        token.organization = (user as any).organization
        token.position = (user as any).position
        token.photoURL = user.image || (user as any).photoURL

        if (account) {
          // Generate internal JWT for WebSocket authentication
          try {
            const internalJWT = await generateInternalJWT(
              user.id,
              user.email || undefined,
              normalizeUserRole((user as any).role || (token.role as string))
            )
            token.accessToken = internalJWT
          } catch (error) {
            console.error('Failed to generate internal JWT:', error)
            // Fallback to OAuth token if available
            token.accessToken = account.access_token
          }
          
          token.refreshToken = account.refresh_token
          token.provider = account.provider
        }

        if (account?.provider === "crypto-wallet" && !user.email) {
          token.needsOnboarding = true
        }
      }
      
      // Coerce DB/OAuth uppercase roles (e.g. SUBSCRIBER) to canonical lowercase UserRole
      token.role = normalizeUserRole(token.role as string | undefined)

      // Regenerate accessToken if it's missing or expired
      if (!token.accessToken && token.userId) {
        try {
          const internalJWT = await generateInternalJWT(
            token.userId as string,
            token.email as string || undefined,
            token.role as string
          )
          token.accessToken = internalJWT
        } catch (error) {
          console.error('Failed to regenerate internal JWT:', error)
        }
      }
      
      return token
    },

    async session({ session, token }) {
      // Reduced logging - only log if there's an issue
      if (token) {
        session.user.id = token.userId as string
        session.user.role = normalizeUserRole(token.role as string | undefined)
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string

        // Add custom fields from database
        ;(session.user as any).username = token.username as string
        ;(session.user as any).phoneNumber = token.phoneNumber as string
        ;(session.user as any).bio = token.bio as string
        ;(session.user as any).organization = token.organization as string
        ;(session.user as any).position = token.position as string
        // Update photo URL with stored version if available
        if (token.photoURL) {
          session.user.image = token.photoURL as string
        }
        // Use the generated internal JWT token for WebSocket authentication
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }

      return session
    },

    async signIn({ user, account, profile }) {
      try {
        console.log('SignIn callback triggered:', {
          provider: account?.provider,
          userId: user.id,
          email: user.email,
          hasAdapter: hasAdapter,
          usePostgreSQL
        })

            // Special handling for Google One Tap - verify the JWT token here
            if (account?.provider === "google-one-tap") {
              console.log('🔵 Google One Tap detected in signIn callback - verifying JWT token')
              
              // For credentials providers, the credential is stored in the user.email field
              const credential = user.email
              if (!credential || credential.length < 100) { // JWTs are typically 1000+ chars
                console.error('🔵 No valid credential found in user.email')
                return false
              }

          try {
            console.log('🔵 Verifying Google ID token in signIn callback...')
            console.log('🔵 Token length:', credential.length)
            
            const ticket = await googleAuthClient.verifyIdToken({
              idToken: credential,
              audience: getGoogleIdTokenAudiences(),
            })

            const payload = ticket.getPayload()
            console.log('🔵 Google ID token verified successfully in signIn callback')
            console.log('🔵 Payload:', {
              sub: payload?.sub,
              email: payload?.email,
              name: payload?.name,
              email_verified: payload?.email_verified
            })
            
            if (!payload) {
              console.error('🔵 No payload in verified token')
              return false
            }

            // Update the user object with real Google data
            user.id = payload.sub
            user.email = payload.email || ''
            user.name = payload.name || ''
            user.image = payload.picture || null
            ;(user as any).emailVerified = payload.email_verified ? new Date() : null

            console.log('🔵 Updated user object with Google data:', {
              id: user.id,
              email: user.email,
              name: user.name
            })
          } catch (error) {
            console.error('🔵 Google token verification failed in signIn callback:', error)
            console.error('🔵 Error details:', (error as any).message)
            return false
          }
        }

        // When using adapter (PostgreSQL or Firebase), the adapter handles user creation
        // We only need to handle special cases here
        
        if (usePostgreSQL) {
          // PostgreSQL adapter via BackendSelector
          // The adapter will handle user creation automatically
          console.log('✅ Using PostgreSQL adapter - user creation handled by adapter')

          console.log('🔵 Checking for Google One Tap provider:', { provider: account?.provider, userId: user.id })

          // For Google One Tap, ensure user is created in database
          if (account?.provider === "google-one-tap") {
            try {
              console.log('🔵 Google One Tap condition met - ensuring user exists in PostgreSQL:', user.id)
              let existingUser = null
              try {
                const readResult = await db().readDoc('users', user.id)
                if (readResult.success && readResult.data) {
                  existingUser = readResult.data
                  console.log('🔵 Google One Tap user already exists in PostgreSQL:', user.id)
                }
              } catch (readError) {
                console.log('🔵 Error reading user (might not exist yet):', (readError as any).message)
              }

              // Create new user if not found
              if (!existingUser) {
                console.log('🔵 Creating new Google One Tap user in PostgreSQL:', user.email)

                const now = new Date()
                const userData = {
                  email: user.email,
                  emailVerified: (user as any).emailVerified || null,
                  name: user.name,
                  image: user.image,
                  role: 'SUBSCRIBER',
                  isVerified: !!(user as any).emailVerified,
                  createdAt: now,
                  lastLogin: now,
                  bio: '',
                  username: null,
                  phoneNumber: null,
                  organization: null,
                  position: null,
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

                try {
                  const createResult = await db().createDoc('users', userData, { id: user.id })
                  if (createResult.success) {
                    console.log('✅ Google One Tap user created successfully in PostgreSQL:', user.id)
                  } else {
                    console.error('❌ Failed to create Google One Tap user:', createResult.error)
                    // Don't fail the authentication if user creation fails
                    // The user can still use the app with JWT session
                  }
                } catch (createError) {
                  console.error('❌ Exception during Google One Tap user creation:', createError)
                  // Continue with authentication even if database operations fail
                }
              }
            } catch (error) {
              console.error('❌ Error in Google One Tap user handling:', error)
              // Continue with authentication - don't fail due to database issues
            }
          }
          
          // NOTE: Wallet creation moved to events.signIn callback (non-blocking)
          // This allows profile to load instantly without waiting for wallet creation
          
          return true
        } else if (useFirebase) {
          // Firebase adapter - let it handle user creation
          console.log('✅ Using Firebase adapter - user creation handled by adapter')
          return true
        } else {
          // JWT-only mode without adapter
          console.log('⚠️  JWT-only mode - no database persistence')
          return true
        }
      } catch (error) {
        console.error("Sign in error:", error)
        
        // Allow authentication to continue even if there are database errors
        // This ensures users can still log in with JWT sessions
        console.warn("Database error during sign in, proceeding with JWT-only session")
        return true
      }
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in with ${account?.provider}`)

      if (isNewUser && user.id) {
        try {
          const { cookies } = await import('next/headers')
          const { REF_COOKIE_NAME } = await import('@/features/refcodes/constants')
          const { persistSignupReferralAttribution } = await import(
            '@/features/refcodes/services/attribution-service'
          )
          const refCode = (await cookies()).get(REF_COOKIE_NAME)?.value
          if (refCode) {
            await persistSignupReferralAttribution(user.id, refCode)
          }
        } catch (referralPersistError) {
          console.warn('Signup referral attribution skipped:', referralPersistError)
        }
      }

      // Ensure user document exists in database (migration for existing Auth.js users)
      try {
        console.log('Ensuring user document exists for authenticated user:', user.email)
        await userMigrationService.ensureUserDocument(user as any)
        console.log('User document ensured successfully for authenticated user')
      } catch (error) {
        console.error('Failed to ensure user document exists:', error)
        // Don't fail authentication if user document creation fails
      }

      // Ensure wallet is created for the authenticated user
      try {
        console.log('Ensuring wallet for OAuth user:', user.email)
        await ensureWallet({
          id: user.id,
          role: (user as any).role || 'SUBSCRIBER'
        })
        console.log('Wallet ensured successfully for OAuth user')
      } catch (error) {
        console.error('Failed to ensure wallet for OAuth user:', error)
        // Don't fail authentication if wallet creation fails
      }
    },
    async signOut() {
      console.log(`User signed out`)
    },
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`)
    },
  },
  debug: process.env.AUTH_DEBUG === "true", // Disabled by default to reduce log noise
})

const { auth: nextAuthBase, handlers, signIn, signOut } = nextAuthApp

/**
 * Auth.js v5 Universal auth() method
 * Replaces getServerSession, getToken, etc.
 * MCP service gateway injects a synthetic SUPERADMIN session via AsyncLocalStorage.
 *
 * Typed as zero-arg server session lookup — do not use Parameters<typeof nextAuthBase>
 * (that resolves to the middleware overload and breaks every await auth() call site).
 */
export async function auth(): Promise<Session | null> {
  const mcpActor = getMcpActor()
  if (mcpActor) {
    return {
      user: {
        id: mcpActor.id,
        email: mcpActor.email,
        name: mcpActor.name,
        role: mcpActor.role,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as Session
  }
  return nextAuthBase()
}

export { handlers, signIn, signOut }

export default { auth }