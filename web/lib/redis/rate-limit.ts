/**
 * Redis INCR + EXPIRE rate limit with in-process Map fallback.
 * Shares REDIS_URL with lib/redis/set-nx.ts (optional at replicas=1).
 */

import 'server-only'

type RedisClient = {
  multi: () => {
    incr: (key: string) => unknown
    pExpire: (key: string, ms: number) => unknown
    exec: () => Promise<unknown>
  }
  incr: (key: string) => Promise<number>
  pExpire: (key: string, ms: number) => Promise<boolean>
  pTTL: (key: string) => Promise<number>
}

type Bucket = { count: number; resetAt: number }

const memory = new Map<string, Bucket>()
let clientPromise: Promise<RedisClient | null> | null = null
let loggedFallback = false

function pruneMemory(now: number) {
  for (const [k, b] of memory) {
    if (b.resetAt <= now) memory.delete(k)
  }
}

async function getRedisClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const mod = await import('redis')
        const client = mod.createClient({ url })
        client.on('error', (err: unknown) => {
          console.warn('[redis-rate-limit] client error', err)
        })
        await client.connect()
        return client as unknown as RedisClient
      } catch (err) {
        console.warn('[redis-rate-limit] connect failed; using Map fallback', err)
        return null
      }
    })()
  }
  return clientPromise
}

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetAt: number
  backend: 'redis' | 'memory'
}

/**
 * Consume one unit from a sliding fixed window (count resets after windowMs).
 */
export async function consumeRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const client = await getRedisClient()

  if (client) {
    try {
      const count = await client.incr(key)
      if (count === 1) {
        await client.pExpire(key, windowMs)
      }
      const ttl = await client.pTTL(key)
      const resetAt = now + (ttl > 0 ? ttl : windowMs)
      if (count > maxPerWindow) {
        return { ok: false, remaining: 0, resetAt, backend: 'redis' }
      }
      return {
        ok: true,
        remaining: Math.max(0, maxPerWindow - count),
        resetAt,
        backend: 'redis',
      }
    } catch (err) {
      if (!loggedFallback) {
        loggedFallback = true
        console.warn('[redis-rate-limit] INCR failed; Map fallback', err)
      }
    }
  }

  pruneMemory(now)
  const existing = memory.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    memory.set(key, { count: 1, resetAt })
    return { ok: true, remaining: maxPerWindow - 1, resetAt, backend: 'memory' }
  }
  if (existing.count >= maxPerWindow) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt, backend: 'memory' }
  }
  existing.count += 1
  memory.set(key, existing)
  return {
    ok: true,
    remaining: maxPerWindow - existing.count,
    resetAt: existing.resetAt,
    backend: 'memory',
  }
}
