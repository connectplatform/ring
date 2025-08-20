import { createAuthClient } from 'better-auth/react'

// Create the auth client for client-side usage
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXTAUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
})

// Export commonly used methods
export const { signIn, signOut, signUp, getSession, useSession } = authClient

// Export the client as default
export default authClient
