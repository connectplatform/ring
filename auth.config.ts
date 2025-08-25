import type { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import Resend from "next-auth/providers/resend"
import { UserRole } from "@/features/auth/types"

/**
 * Auth.js v5 Edge-Compatible Configuration
 * This config is used in middleware and edge runtime
 */
export default {
  providers: [
    // Magic Link Email Authentication (Primary for registration/access)
    Resend({
      // Auth.js v5 automatically uses AUTH_RESEND_KEY
      from: "noreply@ring.ck.ua",
    }),
    // Google OAuth (Preferred signin option)
    GoogleProvider({
      // Auth.js v5 automatically uses AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      // Auth.js v5 stricter OAuth compliance - ensure proper PKCE and state handling
      checks: ["pkce", "state"],
      // Explicitly set wellKnown endpoint for better reliability
      wellKnown: "https://accounts.google.com/.well-known/openid-configuration",
    }),
    // Apple OAuth
    AppleProvider({
      // Auth.js v5 automatically uses AUTH_APPLE_ID and AUTH_APPLE_SECRET
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
    CredentialsProvider({
      id: "crypto-wallet",
      name: "Crypto Wallet",
      credentials: {
        walletAddress: { label: "Wallet Address", type: "text" },
        signedNonce: { label: "Signed Nonce", type: "text" },
      },
      async authorize(credentials) {
        // Edge runtime compatible - minimal validation
        if (!credentials?.walletAddress || !credentials?.signedNonce) {
          return null
        }

        // Return basic user info - full validation happens in server-side auth.ts
        return {
          id: credentials.walletAddress as string,
          email: "",
          name: null,
          image: null,
          role: UserRole.SUBSCRIBER,  
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')
      const isOnProfile = nextUrl.pathname.startsWith('/profile')
      const isOnSettings = nextUrl.pathname.startsWith('/settings')
      
      // Protect dashboard routes
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Redirect unauthenticated users to login page
      } 
      
      // Protect admin routes
      if (isOnAdmin) {
        if (isLoggedIn && auth?.user?.role === UserRole.ADMIN) return true
        return false
      }
      
      // Protect profile routes
      if (isOnProfile || isOnSettings) {
        if (isLoggedIn) return true
        return false
      }
      
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role || UserRole.SUBSCRIBER
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
} satisfies NextAuthConfig 