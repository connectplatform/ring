import { handlers } from '@/auth'
import { connection } from 'next/server'

/**
 * Auth.js v5 — We need a dynamic request context for handling cookies + database session per request.
 * The `connection` function ensures DB connection is initialized for every incoming request.
 * The handlers object provides GET and POST handlers for Next.js API routes, wrapping Auth.js logic.
 * db().*Doc methods auto-initialize connections as needed.
 * 
 * Note: This pattern works for Next.js 16 API Routes (app router), but may need reconsideration for future streaming/edge support.
 * 
 * // TODO: Consider using Next.js 16 "Dynamic Functions" or Route Handlers' middleware for less repetition on context initialization.
 */

// Wrapper for GET method on this API route.
// Ensures DB connection before delegating to actual Auth.js GET handler.
export async function GET(
  ...args: Parameters<typeof handlers.GET>
) {
  await connection() // Initialize DB connection per request. Important for serverless.
  return handlers.GET(...args) // Delegate request to Auth.js GET handler.
}

// Wrapper for POST method on this API route.
// Ensures DB connection before delegating to actual Auth.js POST handler.
export async function POST(
  ...args: Parameters<typeof handlers.POST>
) {
  await connection() // Initialize DB connection per request.
  return handlers.POST(...args) // Delegate to Auth.js POST handler.
}
