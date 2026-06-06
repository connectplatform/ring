/**
 * Per-user rate limit for FCM register (POST).
 * In-memory store; 10 requests per user per minute.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

const store = new Map<string, { count: number; resetAt: number }>()

export function checkFcmRegisterRateLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const entry = store.get(userId)

  if (!entry) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (now >= entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  entry.count++
  return { allowed: true }
}
