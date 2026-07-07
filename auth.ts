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
  type AuthUser,
  type Wallet,
  type UserSettings,
  type NotificationPreferences,
} from "@/features/auth/types"
import { UserRolesArray, resolveSessionUserRole } from "@/features/auth/user-role"
import { ensureWallet } from "@/features/wallet/services/ensure-wallet"
import { userMigrationService } from "@/features/auth/services/user-migration"
import { shouldSkipDatabaseConnect } from "@/lib/build-cache/phase-detector"
import {
  getGoogleIdTokenAudiences,
  getGoogleOAuthClientId,
} from "@/lib/auth/google-oauth-client"
import { getMcpActor } from "@/lib/auth/mcp-actor-context"
import {
  createOAuthUserFromGooglePayload,
  ensureGoogleAccountLinked,
  findUserByEmail,
  normalizeAuthEmail,
  resolveCanonicalUser,
} from "@/features/auth/services/user-resolve"
import {
  isAccountLoginAllowed,
  normalizeAccountStatus,
} from "@/features/auth/lib/account-status"
import { getUserAccountStatus } from "@/features/auth/services/user-account-status"
import {
  applyUserRowToJwt,
  accountStatusFromJwt,
  suspensionReasonFromJwt,
} from "@/lib/auth/session-user-status"

// TODO: On Next.js 14+ ensure use of native server actions for all authentication action handlers (see Next 14 docs).
// TODO: Consider codemod to `export const { auth, handlers, signIn, signOut }` using new NextAuth direct exports if using next-auth v5+ and Next.js 14+.

const googleOAuthClientId = getGoogleOAuthClientId() // Fetch Google OAuth client ID from env/config

// Initialize Google Auth client for server-side ID token verification
const googleAuthClient = new OAuth2Client(googleOAuthClientId)

// Utility for conditional logging during dev/testing
const shouldLogAuth = () => {
  // Never log during build or in production (unless overridden).
  if (process.env.npm_lifecycle_event === 'build' || process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.DB_DEBUG === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.DB_DEBUG !== 'false');
};

// Convenience wrapper for logs that only output if shouldLogAuth is true.
const authLog = (...args: any[]) => {
  if (shouldLogAuth()) {
    console.log(...args);
  }
};

// Helper to distinguish if current sign in context is Google One Tap.
function isGoogleOneTapSignIn(
  account: { provider?: string } | null | undefined,
  user: { id?: string | null }
): boolean {
  return account?.provider === 'google-one-tap' || user.id === 'gis-jwt-pending'
}

/**
 * Main NextAuth configuration object.
 * Configures adapter selection, session, providers, and all callbacks/events.
 */

// Get singleton auth adapter (may be null during build)
const authAdapter = getAuthAdapter()

// Backend mode selection for adapter targeting
import { shouldUseFirebaseForDatabase } from './lib/database/backend-mode-config'
const useFirebase = shouldUseFirebaseForDatabase()
const usePostgreSQL = !useFirebase

// Feature toggling for providers requiring backend persistence
const hasAdapter = !!authAdapter
const hasResendKey = process.env.AUTH_RESEND_KEY;

// Warn in case misconfiguration is detected (skipped during build)
if (!hasAdapter && hasResendKey && !shouldSkipDatabaseConnect()) {
  // Warn if magic email auth can't be enabled due to missing DB adapter
  console.warn(
    "AUTH_RESEND_KEY is set but no Auth.js database adapter is available. Magic link authentication will be disabled.",
  )
}
if (hasAdapter && !hasResendKey && !shouldSkipDatabaseConnect()) {
  // Info if Resend (magic link) can't be enabled because key is missing
  console.info(
    "AUTH_RESEND_KEY not set. Magic link authentication will be disabled. Set AUTH_RESEND_KEY to enable email authentication.",
  )
}

// TODO: When Next.js 14+ stable, consider moving auth options to app/api/auth/[[...nextauth]]/route.ts for native route segment support

const nextAuthApp = NextAuth({
  ...authConfig, // Bring in custom user config
  // Attach DB adapter if present (PostgreSQL or Firebase based on env mode)
  ...(hasAdapter && { adapter: authAdapter }),
  session: { 
    strategy: "jwt", // JWT improves edge support and resilience
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // 24 hours, session token will refresh if accessed
  },
  trustHost: true, // Next.js deployment best practice for Vercel/self-hosted
  useSecureCookies: process.env.NODE_ENV === "production", // Secure for prod, relaxed for dev
  cookies: {
    sessionToken: {
      // Use __Secure- prefix for secure cookies in prod
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
    // Email-based authentication with Resend (magic link, if enabled)
    ...(hasAdapter && hasResendKey ? [
      Resend({
        // Email magic link via Resend.io
        from: process.env.AUTH_RESEND_FROM || "noreply@ring-platform.org",
      })
    ] : []),

    // Standard Google OAuth provider (interactive consent flow, for full user experience)
    GoogleProvider({
      allowDangerousEmailAccountLinking: true, // Allow linking same email across providers
      authorization: { params: { response_type: "code" } }, // Explicit grant params
      checks: ["pkce", "state"], // Recommended for modern OAuth security
      wellKnown: "https://accounts.google.com/.well-known/openid-configuration",
    }),

    // Google One Tap "credentials" provider for GIS JWT-encoded credentials
    CredentialsProvider({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: {
        credential: { type: 'text' },
      },
      // Only validates structure, actual JWT verification happens later in signIn callback
      async authorize(credentials) {
        // Authorize method for Google One Tap
        if (!credentials?.credential) {
          authLog('🟡 No GIS JWT credential provided')
          return null
        }
        authLog('🟡 GIS JWT provider - passing credential for server verification')
        authLog('🟡 JWT length:', (credentials.credential as string).length)
        // Place the JWT in email field for later extraction
        // TODO: switch to dedicated field or session storage for improved clarity if supported by next-auth
        return {
          id: 'gis-jwt-pending',
          email: credentials.credential as string, // Store JWT credential here for signIn callback
          name: 'GIS User',
          image: null,
          role: UserRolesArray.subscriber as UserRolesArray, // Assign a default role for session
        }
      },
    }),

    // Apple OAuth provider for Apple SSO
    AppleProvider({
      allowDangerousEmailAccountLinking: true,
    }),

    // Crypto Wallet authentication via EVM signature (MetaMask, WalletConnect, etc)
    CredentialsProvider({
      id: "crypto-wallet",
      name: "Crypto Wallet",
      credentials: {
        walletAddress: { label: "Wallet Address", type: "text" },
        signedNonce: { label: "Signed Nonce", type: "text" },
      },
      async authorize(credentials) {
        // Validate the presence of required wallet credentials
        if (!credentials?.walletAddress || !credentials?.signedNonce) return null
        const walletAddress = String(credentials.walletAddress)
        const signedNonce = String(credentials.signedNonce)
        try {
          // Normalize wallet storage id for DB operations
          const storageId = normalizeWalletStorageId(walletAddress)
          let userData: Record<string, unknown> | null = null

          // Read user by wallet from DB (PostgreSQL or Firebase)
          if (usePostgreSQL) {
            const userResult = await db().readDoc<Record<string, unknown>>('users', storageId)
            if (!userResult.success) {
              if (userResult.metadata?.operation === 'initialize') authLog("Crypto wallet auth: database init failed", userResult.error)
              return null
            }
            if (userResult.data) {
              userData = userResult.data
            }
          } else if (useFirebase) {
            const db = getAdminDb()
            if (!db) throw new Error("Firestore instance is not available")
            const userDoc = await db.collection("users").doc(storageId).get()
            userData = userDoc.exists ? (userDoc.data() as Record<string, unknown>) : null
          }

          // Validate nonce existence and expiry
          const nonce = userData?.nonce
          if (!nonce || typeof nonce !== "string") return null
          const nonceExpires = userData?.nonceExpires
          if (typeof nonceExpires === "number" && nonceExpires < Date.now()) return null

          // Verify wallet signature using nonce
          const valid = await verifyWalletNonceSignature({
            walletAddress,
            nonce,
            signature: signedNonce,
          })
          if (!valid) return null

          // On success, clear nonce/nonceExpires and stamp lastLogin
          const clearedNonce = {
            ...userData,
            nonce: null,
            nonceExpires: null,
            lastLogin: new Date(),
          }

          // Persist updated user fields
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

          // Create auth session object for downstream use
          const now = new Date()
          return {
            id: storageId,
            email: String(userData?.email || ""),
            name: (userData?.name as string | null) || null,
            image: (userData?.photoURL as string | null) || (userData?.image as string | null) || null,
            role: (userData?.role as UserRolesArray) || UserRolesArray.subscriber as UserRolesArray,
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
    // JWT callback: enrich JWT with user data and custom claims
    async jwt({ token, user, account, trigger }) {
      // Log important JWT events only if allowed
      if (process.env.NODE_ENV === 'development' || process.env.AUTH_DEBUG === 'true') {
        if (trigger === 'update' || (user && account)) {
          authLog('JWT callback:', { trigger, hasUser: !!user, userId: user?.id })
        }
      }

      // Decide if we need to fetch/update fresh user data from DB. This keeps JWT stateless but up-to-date.
      const needsUserData =
        trigger === 'update' ||
        (user && account) ||
        (user && !token.name) ||
        (token.userId && !token.role) ||
        (token.userId && token.accountStatus === undefined)

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
              // Fetch user record from DB. Strongly type to UserRow if available.
              const result = await db().readDoc<import('@/features/auth/lib/user-row').UserRow>('users', userId)
              if (!result.success) {
                if (result.metadata?.operation === 'initialize') {
                  authLog('Database initialization failed in JWT callback:', result.error)
                }
                return token // STUB: consider error resilience when DB unavailable
              }
              if (result.data) {
                // Found fresh user, merge into JWT payload
                const userData = result.data
                if (process.env.NODE_ENV === 'development' || process.env.DB_DEBUG === 'true') {
                  authLog('Found user data in PostgreSQL:', { name: userData?.name, email: userData?.email, role: userData?.role })
                }
                applyUserRowToJwt(token, userData)
              } else {
                // If user not found by ID, attempt repair based on email
                authLog('User document not found in PostgreSQL for ID:', userId)
                const repairEmail = normalizeAuthEmail(
                  (token.email as string | undefined) || user?.email || undefined
                )
                if (repairEmail) {
                  const canonical = await findUserByEmail(repairEmail)
                  if (canonical) {
                    authLog('JWT repair: remapping userId to canonical email match:', canonical.id)
                    token.userId = canonical.id
                    applyUserRowToJwt(token, canonical)
                  }
                }
              }
            }
          } else if (useFirebase) {
            // Read user doc from Firestore DB if in Firebase mode
            const db = getAdminDb()
            if (db && (token.userId || user?.id)) {
              const userId = (token.userId as string) || user?.id
              console.log('Looking up user document in Firebase for ID:', userId)
              const userDoc = await db.collection("users").doc(userId).get()

              if (userDoc.exists) {
                const userData = userDoc.data()
                console.log('Found user data in Firebase:', { name: userData?.name, email: userData?.email, role: userData?.role })
                // Update all user fields on token
                token.username = userData?.username
                token.phoneNumber = userData?.phoneNumber
                token.bio = userData?.bio
                token.organization = userData?.organization
                token.position = userData?.position
                token.photoURL = userData?.photoURL
                token.role = userData?.role ?? UserRolesArray.subscriber as UserRolesArray
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

      // If new/user present, always hydrate JWT with live info
      if (user) {
        token.userId = user.id
        token.role = token.role || (user as any).role || UserRolesArray.subscriber as UserRolesArray
        token.isVerified = (user as any).isVerified ?? false
        token.username = (user as any).username
        token.phoneNumber = (user as any).phoneNumber
        token.bio = (user as any).bio
        token.organization = (user as any).organization
        token.position = (user as any).position
        token.photoURL = user.image || (user as any).photoURL
        if (account) {
          // For new connection, generate internal WS-auth JWT in accessToken field.
          try {
            const internalJWT = await generateInternalJWT(
              user.id,
              user.email || undefined,
              resolveSessionUserRole((user as any).role || (token.role as string))
            )
            token.accessToken = internalJWT
          } catch (error) {
            console.error('Failed to generate internal JWT:', error)
            // Fallback to provider's OAuth token if generation failed
            token.accessToken = account.access_token
          }
          token.refreshToken = account.refresh_token
          token.provider = account.provider
        }
        // If wallet user has no email, need onboarding
        if (account?.provider === "crypto-wallet" && !user.email) {
          token.needsOnboarding = true
        }
      }

      // Always resolve role into canonical string
      token.role = resolveSessionUserRole(token.role)

      // If accessToken is missing (e.g., from a previous session), attempt regeneration
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

    // Session callback - attaches all custom/user claims to outgoing session object
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.role = resolveSessionUserRole(token.role)
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string

        // Attach status/suspension reasons if set
        ;(session.user as { accountStatus?: string }).accountStatus =
          accountStatusFromJwt(token)
        ;(session.user as { suspensionReason?: string }).suspensionReason =
          suspensionReasonFromJwt(token)
        // Add custom user fields persisted in DB
        ;(session.user as any).username = token.username as string
        ;(session.user as any).phoneNumber = token.phoneNumber as string
        ;(session.user as any).bio = token.bio as string
        ;(session.user as any).organization = token.organization as string
        ;(session.user as any).position = token.position as string
        // Hydrate user image if we have stored photoURL
        if (token.photoURL) {
          session.user.image = token.photoURL as string
        }
        // Expose JWTs/tokens for use in websocket, API calls
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }

      return session
    },

    // Custom signIn callback – handles advanced flows, validation, and Google One Tap verification
    async signIn({ user, account, profile }) {
      try {
        console.log('SignIn callback triggered:', {
          provider: account?.provider,
          userId: user.id,
          email: user.email,
          hasAdapter: hasAdapter,
          usePostgreSQL
        })
        // Special handling for Google One Tap tokens
        if (isGoogleOneTapSignIn(account, user)) {
          console.log('🔵 Google One Tap detected in signIn callback - verifying JWT token')
          // The credentials JWT comes in as user.email (due to next-auth credentials provider pattern)
          const credential = user.email
          if (!credential || credential.length < 100) { // JWT is 1000+ chars typically
            console.error('🔵 No valid credential found in user.email')
            return false
          }
          try {
            // Verify received GIS JWT using Google public key
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
            if (!payload?.sub || !payload.email) {
              console.error('🔵 Missing sub or email in verified token')
              return false
            }
            const googleSub = payload.sub
            // Normalize/ensure canonical email format
            const email = normalizeAuthEmail(payload.email)
            const emailVerified = payload.email_verified ? new Date() : null
            // Find or create canonical user for this email
            const resolved = await resolveCanonicalUser({ email })
            if (resolved.userRow) {
              user.id = resolved.canonicalId
              console.log('🔵 One Tap reusing canonical user:', user.id)
            } else {
              // No user found → create new
              // TODO: Replace use of `crypto.randomUUID()` with native React/Next generated UUID if available in context (e.g. via import { randomUUID } from "node:crypto")
              user.id = crypto.randomUUID()
              await createOAuthUserFromGooglePayload({
                userId: user.id,
                email,
                name: payload.name,
                image: payload.picture,
                emailVerified,
              })
              console.log('🔵 One Tap created new canonical user:', user.id)
            }
            // Ensure this Google account is linked with our user record (OAuth/one-tap duality)
            await ensureGoogleAccountLinked({
              userId: user.id,
              providerAccountId: googleSub,
              idToken: credential,
            })
            user.email = email
            user.name = payload.name || ''
            user.image = payload.picture || null
            ;(user as any).emailVerified = emailVerified
            ;(user as any).role = (resolved.userRow?.role as UserRolesArray) || UserRolesArray.subscriber as UserRolesArray
            console.log('🔵 Updated user object with canonical Google data:', {
              id: user.id,
              email: user.email,
              name: user.name,
              googleSub,
            })
          } catch (error) {
            // JWT or token verification failed
            console.error('🔵 Google token verification failed in signIn callback:', error)
            console.error('🔵 Error details:', (error as any).message)
            return false
          }
        }

        // Block sign-ins to suspended/disabled accounts if on PostgreSQL
        if (usePostgreSQL) {
          const loginUserId = user.id
          if (loginUserId) {
            const { status } = await getUserAccountStatus(loginUserId)
            if (!isAccountLoginAllowed(status)) {
              console.warn('Sign-in blocked for account status:', status, loginUserId)
              return false
            }
            ;(user as { accountStatus?: string }).accountStatus = status
          }
          console.log('✅ Using PostgreSQL adapter - user creation handled by adapter')
          return true
        } else if (useFirebase) {
          // Firestore handles user sign up; no extra step needed here
          console.log('✅ Using Firebase adapter - user creation handled by adapter')
          return true
        } else {
          // JWT-only "stateless" mode -- no backend persistence
          // STUB: Consider blocking magiclink/Google/Apple sign-ins here in full stateless mode if data consistency is required.
          console.log('⚠️  JWT-only mode - no database persistence')
          return true
        }
      } catch (error) {
        // If backend fails, default to allowing sign in for resilience (soft fail open)
        console.error("Sign in error:", error)
        console.warn("Database error during sign in, proceeding with JWT-only session")
        return true
      }
    },
  },
  events: {
    // Side effects on successful signIn (user created, etc)
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in with ${account?.provider}`)

      // Track signup referrals if a ref cookie exists (first sign-up only)
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
          // STUB: Fallback strategy for attribution failure (optionally implement SSR fallback)
          console.warn('Signup referral attribution skipped:', referralPersistError)
        }
      }

      // Ensure canonical user doc exists (migration for old Auth.js users)
      try {
        console.log('Ensuring user document exists for authenticated user:', user.email)
        const canonicalId = await userMigrationService.ensureUserDocument(user as any)
        if (canonicalId && canonicalId !== user.id) {
          user.id = canonicalId
        }
        console.log('User document ensured successfully for authenticated user:', canonicalId)
      } catch (error) {
        // If user doc creation fails, don't block login
        console.error('Failed to ensure user document exists:', error)
      }

      // Ensure initial wallet exists for auth'd user
      try {
        console.log('Ensuring wallet for OAuth user:', user.email)
        await ensureWallet({
          id: user.id,
          role: (user as any).role || UserRolesArray.subscriber as UserRolesArray,
        })
        console.log('Wallet ensured successfully for OAuth user')
      } catch (error) {
        // If wallet fails, do not block authentication
        console.error('Failed to ensure wallet for OAuth user:', error)
      }
    },
    async signOut() {
      console.log(`User signed out`)
    },
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`)
    },
  },
  debug: process.env.AUTH_DEBUG === "true", // Enable Auth.js debug logs if set
})

// Destructure needed helper functions and handlers from NextAuth instance
const { auth: nextAuthBase, handlers, signIn, signOut } = nextAuthApp

/**
 * Universal `auth()` for server session lookup, including MCP service injection.
 * Returns the signed-in user's session, or a synthetic session for superadmin MCP context.
 * 
 * TODO: For Next.js 14/React 19, codemod auth() to app/api/auth/route/segment and always await it, for maximum cross-server support.
 */
export async function auth(): Promise<Session | null> {
  // Next.js 16: opt out of static prerendering — auth() reads cookies/headers
  // via nextAuthBase(), which rejects during SSG with HANGING_PROMISE_REJECTION.
  // connection() signals Next.js that this request is dynamic. Wrapped in
  // try/catch because auth() is also called from non-route contexts (middleware,
  // instrumentation) where connection() may not be available.
  try {
    const { connection } = await import('next/server')
    await connection()
  } catch {
    // Non-route context (middleware, instrumentation) — safe to skip
  }

  const mcpActor = getMcpActor()
  if (mcpActor) {
    // Inject synthetic admin session if context present (used for MCP/gateway calls)
    return {
      user: {
        id: mcpActor.id,
        email: mcpActor.email,
        name: mcpActor.name,
        role: mcpActor.role,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Valid for 1hr
    } as Session
  }
  // Otherwise, use standard next-auth logic
  return nextAuthBase()
}

export { handlers, signIn, signOut }
// TODO: Once Next.js 14 app router fully migrates, directly export these as top-level method exports per NextAuth v5+ docs.

export default { auth }