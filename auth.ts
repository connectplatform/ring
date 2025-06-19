import NextAuth from "next-auth"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"
import authConfig from "./auth.config"
import { ethers } from "ethers"
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
        token.isVerified = (user as any).isVerified ?? false

        if (account) {
          token.accessToken = account.access_token
          token.refreshToken = account.refresh_token
          token.provider = account.provider
        }

        if (account?.provider === "crypto-wallet" && !user.email) {
          token.needsOnboarding = true
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.role = token.role as UserRole
        session.user.isVerified = token.isVerified as boolean
        session.user.needsOnboarding = token.needsOnboarding as boolean
        session.user.provider = token.provider as string
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

            await userDoc.ref.set({
              email: user.email,
              name: user.name,
              photoURL: user.image,
              role: UserRole.SUBSCRIBER,
              authProvider: account.provider,
              authProviderId: account.providerAccountId,
              isVerified: true, // OAuth providers are pre-verified
              createdAt: now,
              lastLogin: now,
              bio: "",
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