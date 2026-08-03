/**
 * In-memory guest Q&A rate limit (per process).
 * TODO: Move to Redis / edge KV for multi-replica production.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 8

export function guestAgentRateLimitKey(ip: string, productId: string): string {
  return `${ip || 'unknown'}::${productId}`
}

export function consumeGuestAgentQuota(key: string): {
  ok: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_MS
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: MAX_PER_WINDOW - 1, resetAt }
  }
  if (existing.count >= MAX_PER_WINDOW) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }
  existing.count += 1
  buckets.set(key, existing)
  return { ok: true, remaining: MAX_PER_WINDOW - existing.count, resetAt: existing.resetAt }
}
