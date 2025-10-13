import NextAuth from "next-auth"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"
import { PostgreSQLAdapter } from "@/lib/auth/postgres-adapter"
import { getDatabaseService } from "@/lib/database/DatabaseService"
import authConfig from "./auth.config"
import Resend from "next-auth/providers/resend"
import { ethers } from "ethers"
import { OAuth2Client } from 'google-auth-library'
import { generateInternalJWT } from "@/lib/auth/generate-jwt"
import {
  UserRole,
  type AuthUser,
  type Wallet,
  type UserSettings,
  type NotificationPreferences,
} from "@/features/auth/types"

// Initialize Google Auth client for ID token verification (server-side only)
const googleAuthClient = new OAuth2Client(process.env.AUTH_GOOGLE_ID)

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
 * Adapter selection respects DB_HYBRID_MODE environment variable:
 * - When DB_HYBRID_MODE=false: Uses PostgreSQL adapter (routes through BackendSelector)
 * - When DB_HYBRID_MODE=true or undefined: Uses Firebase adapter (legacy mode)
 */

// Determine database backend from environment
const usePostgreSQL = process.env.DB_HYBRID_MODE === 'false'
const useFirebase = !usePostgreSQL && process.env.AUTH_FIREBASE_PROJECT_ID

// Log adapter configuration when explicitly requested
authLog('🔧 Auth.js adapter:', usePostgreSQL ? 'PostgreSQL' : useFirebase ? 'Firebase' : 'JWT-only')

// Initialize appropriate adapter based on configuration
let authAdapter;

if (usePostgreSQL) {
  try {
    authAdapter = PostgreSQLAdapter()
  } catch (error) {
    console.error("Failed to initialize PostgreSQL adapter:", error);
  }
} else if (useFirebase) {
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      authAdapter = FirestoreAdapter(adminDb);
    }
  } catch (error) {
    console.error("Failed to initialize Firestore adapter:", error);
    console.warn("Continuing without database adapter - JWT-only mode")
  }
} else {
  console.warn('⚠️  No database adapter configured - running in JWT-only mode')
}

// Determine if we should include Resend based on adapter availability
const hasAdapter = !!authAdapter
const hasResendKey = process.env.AUTH_RESEND_KEY;

if (!hasAdapter && hasResendKey) {
  console.warn("AUTH_RESEND_KEY is set but Firebase adapter is not available. Magic link authentication will be disabled.");
}
if (hasAdapter && !hasResendKey) {
  console.info("AUTH_RESEND_KEY not set. Magic link authentication will be disabled. Set AUTH_RESEND_KEY to enable email authentication.");
}

export const { auth, handlers, signIn, signOut } = NextAuth({
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
        from: "noreply@ring.ck.ua",
      })
    ] : []),
    ...authConfig.providers.map(provider => {
      const providerOptions = (provider as any).options || {}
      const providerId = providerOptions.id || provider.id
      // Debug: Log all providers to see what's happening (commented for production)
      // console.log('🔵 Processing provider:', { 
      //   id: provider.id, 
      //   name: provider.name, 
      //   optionsId: providerId,
      //   options: providerOptions 
      // })

      // Google One Tap provider is handled by auth.config.ts edge provider
      // Token verification happens in the signIn callback
      // Override crypto wallet provider with full server-side validation
      if (provider.id === "crypto-wallet") {
        return {
          ...provider,
          async authorize(credentials) {
            if (!credentials) return null

            const { walletAddress, signedNonce } = credentials

            try {
              const db = getAdminDb()
              if (!db) {
                throw new Error("Firestore instance is not available")
              }

              const userDoc = await db
                .collection("users")
                .doc(walletAddress as string)
                .get()
              const userData = userDoc.data()

              if (!userData || !userData.nonce) return null

              const signerAddress = ethers.verifyMessage(userData.nonce, signedNonce as string)

              if (signerAddress !== walletAddress) return null

              if (userData.nonceExpires && userData.nonceExpires < Date.now()) return null

              await userDoc.ref.update({
                nonce: null,
                nonceExpires: null,
              })

              const now = new Date()

              return {
                id: walletAddress as string,
                email: userData.email || "",
                name: userData.name || null,
                image: userData.photoURL || null,
                role: userData.role || UserRole.SUBSCRIBER,
                isVerified: !!userData.isVerified,
                createdAt: userData.createdAt || now,
                lastLogin: now,
              }
            } catch (error) {
              console.error("Crypto wallet auth error:", error)
              return null
            }
          },
        }
      }
      return provider
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account, trigger }) {
      // Only log on significant events (new login, update, or errors)
      if (trigger === 'update' || (user && account)) {
        authLog('JWT callback:', { trigger, hasUser: !!user, userId: user?.id })
      }

      // Fetch fresh user data when needed (on update or new login)
      if (trigger === 'update' || (user && account) || (user && !token.name)) {
        authLog('Fetching fresh user data for userId:', token.userId || user?.id)
        
        try {
          if (usePostgreSQL) {
            // Fetch from PostgreSQL via database abstraction
            const db = getDatabaseService()
            const userId = (token.userId as string) || user?.id
            
            if (userId) {
              authLog('Looking up user in PostgreSQL via BackendSelector:', userId)
              const result = await db.read('users', userId)
              
              if (result.success && result.data) {
                const userData = result.data.data
                authLog('Found user data in PostgreSQL:', { name: userData?.name, email: userData?.email, role: userData?.role })
                
                token.username = userData?.username
                token.phoneNumber = userData?.phoneNumber
                token.bio = userData?.bio
                token.organization = userData?.organization
                token.position = userData?.position
                token.photoURL = userData?.photoURL || userData?.image
                token.role = userData?.role ?? UserRole.SUBSCRIBER
                token.isSuperAdmin = userData?.isSuperAdmin ?? false
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
                token.isSuperAdmin = userData?.isSuperAdmin ?? false
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
        token.role = (user as any).role ?? UserRole.SUBSCRIBER
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false
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
              (user as any).role || UserRole.SUBSCRIBER
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
      
      // Regenerate accessToken if it's missing or expired
      if (!token.accessToken && token.userId) {
        try {
          const internalJWT = await generateInternalJWT(
            token.userId as string,
            token.email as string || undefined,
            token.role as string || UserRole.SUBSCRIBER
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
        session.user.role = token.role as UserRole
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
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
              audience: process.env.AUTH_GOOGLE_ID,
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
              const db = getDatabaseService()
              await db.initialize()
              
              // Check if user already exists
              const existingUser = await db.read('users', user.id)
              if (!existingUser.success || !existingUser.data) {
                console.log('🔵 Creating new Google One Tap user in PostgreSQL:', user.email)
                
                const now = new Date()
                const userData = {
                  email: user.email,
                  emailVerified: (user as any).emailVerified || null,
                  name: user.name,
                  image: user.image,
                  role: 'SUBSCRIBER',
                  isVerified: !!(user as any).emailVerified,
                  isSuperAdmin: false,
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
                
                const createResult = await db.create('users', userData, { id: user.id })
                if (createResult.success) {
                  console.log('🔵 Google One Tap user created successfully in PostgreSQL:', user.id)
                } else {
                  console.error('🔵 Failed to create Google One Tap user:', createResult.error)
                }
              } else {
                console.log('🔵 Google One Tap user already exists in PostgreSQL:', user.id)
              }
            } catch (error) {
              console.error('🔵 Error ensuring Google One Tap user exists:', error)
            }
          }
          
          // Handle wallet creation for new OAuth users
          if (account?.provider === "google" || account?.provider === "apple" || account?.provider === "google-one-tap") {
            // Check if this is a new user (adapter will have just created it)
            // We can add wallet creation logic here if needed
            const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
            
            if (encryptionKey) {
              try {
                console.log('Creating wallet for new user:', user.email)
                // Wallet creation logic can be added here if needed
                // For now, we'll let the adapter handle basic user creation
              } catch (error) {
                console.error('Failed to create wallet for new user:', error)
              }
            }
          }
          
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

/**
 * Auth.js v5 Universal auth() method
 * Replaces getServerSession, getToken, etc.
 */
export default { auth }