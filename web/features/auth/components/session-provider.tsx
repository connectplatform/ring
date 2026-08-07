'use client'

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { Session } from 'next-auth'

/**
 * Props accepted by the SessionProvider component.
 * @property children - The subtree that will have session context.
 * @property session - The session object provided by NextAuth (optional).
 */
interface ProvidersProps {
  children: React.ReactNode
  session?: Session | null
}

/**
 * Auth.js v5 Session Provider
 *
 * Responsibilities:
 * - Wraps the application (or segment) in a NextAuth session context.
 * - Passes an optional initial session from props to enable SSR.
 * - Exposes children within the provider's context.
 *
 * Features:
 * - Auth.js v5 session management via next-auth/react.
 * - Fully compatible with React 19 and Next.js 16.
 * - Tuned refetch behavior — one 15min background poll, no refetch on window
 *   focus/reconnect — cuts redundant `GET /api/auth/session` calls across every
 *   `useSession()` consumer (see `hooks/HOOKS-README.md` Provider matrix).
 *
 * NOTES:
 * - Google sign-in on the login UI uses `signIn('google')` (full-page OAuth), not a nested GIS provider.
 * - To optimize for React 19 and Next 16, consider using the new `use` hook if session needs to be awaited in server components in the future.
 *   // TODO: If migrating part of this to a server component pattern, investigate replacing client context with `use()` for session fetching.
 */
export function SessionProvider({ children, session }: ProvidersProps) {
  // Wrap the given children in the NextAuth SessionProvider, passing session state if provided.
  // This enables all nested components to access session data via useSession(), etc.
  // TODO: Consider adding error boundaries or suspense wrappers as React 19 patterns for improved resilience and loading states.
  return (
    <NextAuthSessionProvider
      session={session}
      refetchInterval={15 * 60}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      {children}
    </NextAuthSessionProvider>
  )
}