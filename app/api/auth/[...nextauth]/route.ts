import { handlers } from '@/auth'
import { connection } from 'next/server'

/**
 * Auth.js v5 — database + cookies require a dynamic request context on Next.js 16+
 * (same pattern as other `/api/*` routes using `initializeDatabase()`).
 */
export async function GET(
  ...args: Parameters<typeof handlers.GET>
) {
  await connection()
  return handlers.GET(...args)
}

export async function POST(
  ...args: Parameters<typeof handlers.POST>
) {
  await connection()
  return handlers.POST(...args)
}
