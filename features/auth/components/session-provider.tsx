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
 * - React 19 compatible
 *
 * Google sign-in on the login UI uses `signIn('google')` (full-page OAuth), not a nested GIS provider.
 */
export function SessionProvider({ children, session }: ProvidersProps) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}