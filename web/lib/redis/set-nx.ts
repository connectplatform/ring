/**
 * Redis SET NX PX helper for multi-pod invite dedupe.
 * Falls back to in-process Map when REDIS_URL is unset or Redis is down.
 *
 * Key shape: peer-game:invite:{from}:{to}:{slug}
 */

import 'server-only'

type RedisClient = {
  set: (
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number },
  ) => Promise<string | null>
  get: (key: string) => Promise<string | null>
  del: (key: string) => Promise<number>
}

const memory = new Map<string, number>()
let clientPromise: Promise<RedisClient | null> | null = null
let loggedFallback = false

function pruneMemory(now: number) {
  for (const [k, exp] of memory) {
    if (exp <= now) memory.delete(k)
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
          console.warn('[redis-set-nx] client error', err)
        })
        await client.connect()
        return client as unknown as RedisClient
      } catch (err) {
        console.warn('[redis-set-nx] connect failed; using Map fallback', err)
        return null
      }
    })()
  }
  return clientPromise
}

/** True when key is already held (cooldown active). */
export async function hasNxKey(
  key: string,
): Promise<{ hit: boolean; backend: 'redis' | 'memory' }> {
  const client = await getRedisClient()
  if (client) {
    try {
      const v = await client.get(key)
      return { hit: v != null, backend: 'redis' }
    } catch (err) {
      if (!loggedFallback) {
        loggedFallback = true
        console.warn('[redis-set-nx] GET failed; Map fallback', err)
      }
    }
  }
  const now = Date.now()
  pruneMemory(now)
  const exp = memory.get(key)
  return { hit: Boolean(exp && exp > now), backend: 'memory' }
}

/**
 * Atomically claim a key for ttlMs. Returns true if this caller owns the claim.
 * Call **after** successful createInvite (plan lock).
 */
export async function setNxPx(
  key: string,
  ttlMs: number,
): Promise<{ claimed: boolean; backend: 'redis' | 'memory' }> {
  const client = await getRedisClient()
  if (client) {
    try {
      const result = await client.set(key, '1', { NX: true, PX: ttlMs })
      return { claimed: result === 'OK', backend: 'redis' }
    } catch (err) {
      if (!loggedFallback) {
        loggedFallback = true
        console.warn('[redis-set-nx] SET NX failed; Map fallback', err)
      }
    }
  }

  const now = Date.now()
  pruneMemory(now)
  const existing = memory.get(key)
  if (existing && existing > now) {
    return { claimed: false, backend: 'memory' }
  }
  memory.set(key, now + ttlMs)
  return { claimed: true, backend: 'memory' }
}

/** Best-effort release (retry after failed create). */
export async function releaseNx(key: string): Promise<void> {
  memory.delete(key)
  const client = await getRedisClient()
  if (!client) return
  try {
    await client.del(key)
  } catch {
    /* ignore */
  }
}
