import NextAuth from "next-auth"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"
import authConfig from "./auth.config"
import { ethers } from "ethers"
import { generateInternalJWT } from "@/lib/auth/generate-jwt"
import {
  UserRole,
  type AuthUser,
  type Wallet,
  type UserSettings,
  type NotificationPreferences,
} from "@/features/auth/types"

/**
 * Auth.js v5 Server-Side Configuration
 * Main authentication configuration with database adapter
 * This is used in server components and API routes
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: FirestoreAdapter(getAdminDb()),
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers.map(provider => {
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
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id
        token.role = (user as any).role ?? UserRole.SUBSCRIBER
        token.isSuperAdmin = (user as any).isSuperAdmin ?? false
        token.isVerified = (user as any).isVerified ?? false

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
      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as UserRole
        session.user.isSuperAdmin = token.isSuperAdmin as boolean
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string
        // Use the generated internal JWT token for WebSocket authentication
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }
      return session
    },

    async signIn({ user, account, profile }) {
      try {
        const db = getAdminDb()
        if (!db) return false

        // Handle different provider types
        if (account?.provider === "google" || account?.provider === "apple") {
          // First check if there's an existing user with this email
          const usersRef = db.collection("users")
          const emailQuery = await usersRef.where("email", "==", user.email).get()
          
          // If user exists with different provider, allow linking
          if (!emailQuery.empty) {
            const existingUser = emailQuery.docs[0]
            const existingData = existingUser.data()
            
            // Check if this is the same provider or if we should link accounts
            if (existingData.authProvider !== account.provider) {
              // Link the accounts by updating the existing user
              await existingUser.ref.update({
                [`linkedProviders.${account.provider}`]: {
                  id: account.providerAccountId,
                  linkedAt: new Date(),
                },
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

            await userDoc.ref.set({
              email: user.email,
              name: user.name,
              photoURL: user.image,
              role: UserRole.SUBSCRIBER,
              authProvider: account.provider,
              authProviderId: account.providerAccountId,
              linkedProviders: {
                [account.provider]: {
                  id: account.providerAccountId,
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
  debug: process.env.NODE_ENV === "development",
})

/**
 * Auth.js v5 Universal auth() method
 * Replaces getServerSession, getToken, etc.
 */
export { auth as getServerAuthSession }