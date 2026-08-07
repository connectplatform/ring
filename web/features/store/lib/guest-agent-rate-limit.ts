/**
 * Guest PDP agent Q&A rate limit.
 * Redis INCR+EXPIRE when REDIS_URL set; Map fallback at single replica.
 */

import { consumeRateLimit } from '@/lib/redis/rate-limit'

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 8

export function guestAgentRateLimitKey(ip: string, productId: string): string {
  return `guest-agent:${ip || 'unknown'}::${productId}`
}

export async function consumeGuestAgentQuota(key: string): Promise<{
  ok: boolean
  remaining: number
  resetAt: number
}> {
  const result = await consumeRateLimit(key, MAX_PER_WINDOW, WINDOW_MS)
  return {
    ok: result.ok,
    remaining: result.remaining,
    resetAt: result.resetAt,
  }
}
