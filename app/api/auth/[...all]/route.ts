import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

// Export the Next.js handler for BetterAuth
export const { POST, GET } = toNextJsHandler(auth)
