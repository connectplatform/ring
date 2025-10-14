'use client'

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { Session } from 'next-auth'

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

/**
 * Auth.js v5 Session Provider
 *
 * Features:
 * - Auth.js v5 session management
 * - Compatible with Google Identity Services (GIS) direct API usage
 * - React 19 compatible
 *
 * Note: Removed GoogleOAuthProvider wrapper to avoid conflicts with
 * GoogleSignInButtonGIS component which uses window.google.accounts.id directly
 */
export function SessionProvider({ children, session }: ProvidersProps) {
  console.log('🔶 SessionProvider rendered - Auth.js v5 only (no GoogleOAuthProvider wrapper)')

  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}