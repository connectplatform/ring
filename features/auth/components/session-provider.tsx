'use client'

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { GoogleOAuthProvider } from '@react-oauth/google'
import type { Session } from 'next-auth'

interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

/**
 * Combined Auth.js v5 + Google Identity Services Provider
 * 
 * Features:
 * - Auth.js v5 session management
 * - Google Identity Services context for One Tap and Sign-In button
 * - React 19 compatible
 */
export function SessionProvider({ children, session }: ProvidersProps) {
  console.log('🔶 SessionProvider rendered with clientId:', process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID)

  return (
    <NextAuthSessionProvider session={session}>
      <GoogleOAuthProvider
        clientId={process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID!}
        onScriptLoadError={() => console.error('🔴 Google Identity Services script failed to load')}
        onScriptLoadSuccess={() => console.log('🟢 Google Identity Services script loaded successfully')}
      >
        {children}
      </GoogleOAuthProvider>
    </NextAuthSessionProvider>
  )
}