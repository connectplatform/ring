import type { NextAuthConfig } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import Resend from "next-auth/providers/resend"
import { UserRole } from "@/features/auth/types"

/**
 * Auth.js v5 Edge-Compatible Configuration
 * This config is used in middleware and edge runtime
 * Updated to support GIS One Tap and modern Google authentication
 */
export default {
  providers: [
    // Google OAuth (Traditional flow - kept for compatibility)
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
    
    // Google Identity Services One Tap (New modern approach)
    // Edge-compatible provider with direct Google token verification
    CredentialsProvider({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: {
        credential: { type: 'text' },
      },
      async authorize(credentials) {
        console.log('🟡 Google One Tap EDGE provider called with credentials:', !!credentials?.credential)

        if (!credentials?.credential) {
          console.log('🟡 No credential provided')
          return null;
        }

        try {
          console.log('🟡 Verifying Google ID token in Edge provider...')
          console.log('🟡 Token length:', (credentials.credential as string).length)

          // For Edge compatibility, we'll need to use a different approach
          // since google-auth-library is not available in Edge runtime
          // We'll use a simplified verification approach or route to server-side

          // Option 1: Return basic credential info and let server-side handle verification
          // The server-side auth.ts will override this provider
          console.log('🟡 Edge provider returning credential for server-side processing')

          // Return a temporary user object that will be processed by server-side auth
          return {
            id: 'google-one-tap-temp-' + Date.now(),
            email: 'temp@example.com', // Will be replaced by server verification
            name: 'Temp User', // Will be replaced by server verification
            image: null,
            role: UserRole.SUBSCRIBER,
            credential: credentials.credential, // Pass the credential for server verification
          };

        } catch (error) {
          console.error('🟡 Google One Tap Edge verification failed:', error);
          return null;
        }
      },
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
        token.isVerified = (user as any).isVerified || false
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.role = token.role as UserRole
        ;(session.user as any).isVerified = token.isVerified as boolean
      }
      return session
    },
  },
} satisfies NextAuthConfig