import type { NextAuthConfig } from "next-auth"
import { UserRole } from "@/features/auth/user-role"

/**
 * Auth.js v5 Edge-Compatible Configuration
 * CRITICAL: This config is used in MIDDLEWARE and EDGE RUNTIME ONLY
 * 
 * Per Auth.js v5 architecture:
 * - auth.config.ts = Edge-compatible (NO providers, NO adapters, minimal callbacks)
 * - auth.ts = Full server config (ALL providers, database adapters, full logic)
 * 
 * Why NO providers here?
 * - OAuth providers bundle 100KB+ of libraries (OIDC clients, JWT parsers, etc)
 * - Middleware runs on EVERY request - must be <50KB for optimal performance
 * - Providers are only needed in auth.ts for actual authentication flows
 * 
 * Middleware only needs:
 * - Session validation (JWT verification)
 * - Route protection logic (callbacks.authorized)
 * - No provider initialization required
 */
export default {
  // EMPTY providers array - all providers defined in auth.ts only
  // Middleware doesn't need providers, only session validation
  providers: [],
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
        token.role = token.role || user.role || UserRole.SUBSCRIBER
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