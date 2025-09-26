import NextAuth from "next-auth"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"
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

/**
 * Auth.js v5 Server-Side Configuration
 * Main authentication configuration with database adapter
 * This is used in server components and API routes
 */
// Initialize Firestore adapter with error handling
let firestoreAdapter;
try {
  const adminDb = getAdminDb();
  if (adminDb) {
    firestoreAdapter = FirestoreAdapter(adminDb);
  }
} catch (error) {
  console.error("Failed to initialize Firestore adapter:", error);
  // Continue without adapter for development/testing
}

// Determine if we should include Resend based on adapter availability
const hasAdapter = firestoreAdapter && process.env.AUTH_FIREBASE_PROJECT_ID;
const hasResendKey = process.env.AUTH_RESEND_KEY;

if (!hasAdapter && hasResendKey) {
  console.warn("AUTH_RESEND_KEY is set but Firebase adapter is not available. Magic link authentication will be disabled.");
}
if (hasAdapter && !hasResendKey) {
  console.info("AUTH_RESEND_KEY not set. Magic link authentication will be disabled. Set AUTH_RESEND_KEY to enable email authentication.");
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // Only use Firestore adapter if properly configured
  ...(hasAdapter && { adapter: firestoreAdapter }),
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
      console.log('🔵 Processing provider:', { id: provider.id, name: provider.name })

      // Override Google One Tap provider with full server-side validation
      if (provider.id === 'google-one-tap') {
        console.log('🔵 Found Google One Tap provider, applying server override')
        console.log('Google One Tap provider override activated for provider:', provider.id)
        return {
          ...provider,
          async authorize(credentials: any) {
            console.log('🔵 Google One Tap SERVER authorize called')
            console.log('🔵 Credentials object:', credentials)
            console.log('🔵 Has credential:', !!credentials?.credential)

            // Handle both direct credential and credential passed from Edge provider
            const token = credentials?.credential;
            console.log('🔵 Token to verify:', token ? 'present' : 'missing')

            if (!token) {
              console.log('🔵 No credential provided to server-side provider')
              return null;
            }

            try {
              console.log('🔵 Verifying Google ID token on server...')
              console.log('🔵 Token length:', token.length)
              console.log('🔵 Google Client ID:', process.env.AUTH_GOOGLE_ID)

              // Verify the ID token from Google Identity Services
              const ticket = await googleAuthClient.verifyIdToken({
                idToken: token as string,
                audience: process.env.AUTH_GOOGLE_ID,
              });

              const payload = ticket.getPayload();
              console.log('🔵 Token verification successful!')
              console.log('🔵 Token payload:', {
                sub: payload?.sub,
                email: payload?.email,
                name: payload?.name,
                email_verified: payload?.email_verified,
                picture: payload?.picture ? 'present' : 'missing'
              })

              if (!payload) {
                console.log('🔵 No payload in token')
                return null;
              }

              // Return user data in Auth.js format
              const user = {
                id: payload.sub,
                email: payload.email,
                name: payload.name,
                image: payload.picture,
                role: UserRole.SUBSCRIBER,
                isVerified: payload.email_verified || false,
              };

              console.log('🔵 Returning verified user from Google One Tap:', {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
              })
              return user;
            } catch (error) {
              console.error('🔵 Google One Tap token verification failed:', error);
              console.error('🔵 Error details:', error.message)
              console.error('🔵 Error stack:', error.stack)

              return null; // Don't return dummy data in production
            }
          },
        }
      }
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
      console.log('JWT callback triggered:', { trigger, hasUser: !!user, hasAccount: !!account, userId: user?.id, tokenUserId: token.userId })

      // Fetch fresh user data from Firebase if needed
      if (trigger === 'update' || (user && account) || (user && !token.name)) {
        console.log('Fetching fresh user data from Firebase for userId:', token.userId || user?.id)
        try {
          const db = getAdminDb()
          if (db && (token.userId || user?.id)) {
            const userId = (token.userId as string) || user?.id
            console.log('Looking up user document for ID:', userId)
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
      console.log('Session callback triggered with token:', { hasToken: !!token, userId: token?.userId, name: token?.name, email: token?.email })

      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as UserRole
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string

        console.log('Session being set with user data:', {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role
        })

        // Add custom fields from Firebase
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

      console.log('Session callback returning session:', {
        hasUser: !!session.user,
        userId: session.user?.id,
        name: session.user?.name,
        email: session.user?.email
      })

      return session
    },

    async signIn({ user, account, profile }) {
      try {
        // If Firebase is not available, allow signin with JWT-only session
        const db = getAdminDb()
        if (!db) {
          console.warn("Firebase not available, allowing JWT-only authentication")
          return true // Allow signin without database operations
        }

        // Handle different provider types including Google One Tap
        if (account?.provider === "google" || account?.provider === "apple" || account?.provider === "google-one-tap") {
          // First check if there's an existing user with this email
          const usersRef = db.collection("users")
          const emailQuery = await usersRef.where("email", "==", user.email).get()
          
          // If user exists with different provider, allow linking
          if (!emailQuery.empty) {
            const existingUser = emailQuery.docs[0]
            const existingData = existingUser.data()
            
            // Check if this is the same provider or if we should link accounts
            // Treat google-one-tap and google as the same provider
            const normalizedProvider = account.provider === 'google-one-tap' ? 'google' : account.provider
            const existingProvider = existingData.authProvider === 'google-one-tap' ? 'google' : existingData.authProvider
            
            if (existingProvider !== normalizedProvider) {
              // Link the accounts by updating the existing user
              await existingUser.ref.update({
                [`linkedProviders.${normalizedProvider}`]: {
                  id: account.providerAccountId || user.id,
                  linkedAt: new Date(),
                },
                lastLogin: new Date(),
              })
              return true
            } else {
              // Same provider, just update last login
              await existingUser.ref.update({
                lastLogin: new Date(),
              })
              return true
            }
          }

          const userDoc = await db.collection("users").doc(user.id).get()
          
          if (!userDoc.exists) {
            // Create new user profile
            const now = new Date()
            const defaultNotificationPreferences: NotificationPreferences = {
              email: true,
              inApp: true,
              sms: false,
            }

            const defaultSettings: UserSettings = {
              language: "en",
              theme: "light",
              notifications: false,
              notificationPreferences: defaultNotificationPreferences,
            }

            // Handle Google profile photo storage
            let storedPhotoURL = user.image
            if ((account?.provider === "google" || account?.provider === "google-one-tap") && user.image) {
              try {
                // Store Google profile photo in our storage system
                console.log('Storing Google profile photo for:', user.email)
                
                const response = await fetch(user.image)
                const imageBlob = await response.blob()
                const file = new File([imageBlob], `${user.id}-google-avatar.jpg`, { type: 'image/jpeg' })
                
                const formData = new FormData()
                formData.append('file', file)
                formData.append('type', 'avatar')
                
                const uploadResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/profile/upload`, {
                  method: 'POST',
                  body: formData,
                })
                
                if (uploadResponse.ok) {
                  const uploadResult = await uploadResponse.json()
                  if (uploadResult.success) {
                    storedPhotoURL = uploadResult.url
                    console.log('Google profile photo stored successfully:', storedPhotoURL)
                  }
                }
              } catch (error) {
                console.error('Failed to store Google profile photo:', error)
                // Keep original Google photo URL as fallback
              }
            }

            // Create wallet for new user (if encryption key is available)
            let wallets: Wallet[] = []
            const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
            
            if (encryptionKey) {
              try {
                console.log('Creating wallet for new user:', user.email)
                const wallet = ethers.Wallet.createRandom()
                const address = await wallet.getAddress()
                const encryptedPrivateKey = await wallet.encrypt(encryptionKey)
                
                wallets = [{
                  address,
                  encryptedPrivateKey,
                  createdAt: now.toISOString(),
                  label: 'Primary Wallet',
                  isDefault: true,
                  balance: '0'
                }]
                console.log('Wallet created successfully:', address)
              } catch (error) {
                console.error('Failed to create wallet for new user:', error)
                // Continue without wallet - user can create one later
              }
            } else {
              console.warn('WALLET_ENCRYPTION_KEY not set - skipping wallet creation for new user')
            }

            // Normalize provider name for storage
            const normalizedProvider = account.provider === 'google-one-tap' ? 'google' : account.provider

            await userDoc.ref.set({
              email: user.email,
              name: user.name,
              photoURL: storedPhotoURL,
              role: UserRole.SUBSCRIBER,
              authProvider: normalizedProvider,
              authProviderId: account.providerAccountId || user.id,
              linkedProviders: {
                [normalizedProvider]: {
                  id: account.providerAccountId || user.id,
                  linkedAt: now,
                }
              },
              isVerified: true, // OAuth providers are pre-verified
              createdAt: now,
              lastLogin: now,
              bio: "",
              wallets, // Add wallets array (empty if creation failed)
              canPostconfidentialOpportunities: false,
              canViewconfidentialOpportunities: false,
              postedopportunities: [],
              savedopportunities: [],
              notificationPreferences: defaultNotificationPreferences,
              settings: defaultSettings,
            })
          } else {
            // Update last login
            await userDoc.ref.update({
              lastLogin: new Date(),
            })
          }
        }

        return true
      } catch (error) {
        console.error("Sign in error:", error)
        
        // If it's a Firebase error, still allow sign-in with JWT-only session
        if (error instanceof Error && (
          error.message.includes('UNAUTHENTICATED') || 
          error.message.includes('Firebase') ||
          error.message.includes('Firestore')
        )) {
          console.warn("Firebase error during sign in, proceeding with JWT-only session")
          return true // Allow authentication to continue without database operations
        }
        
        // For other errors, block authentication
        return false
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