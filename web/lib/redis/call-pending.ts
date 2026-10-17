/**
 * Pending-call-invite registry (server).
 *
 * Purpose: tunnel user-queue delivery is pod-local (in-memory hub) and
 * live-only in postgres-fanout mode — a callee who connects to another pod,
 * or after a pod restart, never receives a queued `calls:incoming` invite.
 * This Redis-backed registry is the replay SSOT:
 *   write  — call-invite route, on every publish (refresh on caller retry)
 *   read   — GET /api/calls/pending (banner mount/reconnect + ?call= deep-link)
 *   clear  — call-event 'missed' (server), banner accept/decline, hook accept/reject
 *
 * Key shape: call:pending:user:{userId} → JSON payload, TTL 60s (= banner
 * ring window). Falls back to in-process Map when REDIS_URL is unset/down,
 * same pattern as lib/redis/set-nx.ts.
 */

import 'server-only'

export const CALL_PENDING_TTL_MS = 60_000

export type CallPendingPayload = {
  callId: string
  conversationId: string
  fromUserId: string
  fromUserName?: string
  media: 'audio' | 'video'
  peerUserId?: string
}

type RedisClient = {
  set: (
    key: string,
    value: string,
    options?: { PX?: number },
  ) => Promise<string | null>
  get: (key: string) => Promise<string | null>
  del: (key: string) => Promise<number>
}

const memory = new Map<string, { value: string; expiresAt: number }>()
let clientPromise: Promise<RedisClient | null> | null = null
let loggedFallback = false

function pruneMemory(now: number) {
  for (const [k, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(k)
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
          console.warn('[redis-call-pending] client error', err)
        })
        await client.connect()
        return client as unknown as RedisClient
      } catch (err) {
        console.warn('[redis-call-pending] connect failed; using Map fallback', err)
        return null
      }
    })()
  }
  return clientPromise
}

function pendingKey(userId: string): string {
  return `call:pending:user:${userId}`
}

/** Write/refresh the pending invite for a callee. */
export async function setCallPending(
  userId: string,
  payload: CallPendingPayload,
  ttlMs: number = CALL_PENDING_TTL_MS,
): Promise<void> {
  const value = JSON.stringify(payload)
  const client = await getRedisClient()
  if (client) {
    try {
      await client.set(pendingKey(userId), value, { PX: ttlMs })
      return
    } catch (err) {
      if (!loggedFallback) {
        loggedFallback = true
        console.warn('[redis-call-pending] SET failed; Map fallback', err)
      }
    }
  }
  const now = Date.now()
  pruneMemory(now)
  memory.set(pendingKey(userId), { value, expiresAt: now + ttlMs })
}

/** Read the pending invite for a user (null when none/expired). */
export async function getCallPending(
  userId: string,
): Promise<CallPendingPayload | null> {
  let raw: string | null = null
  const client = await getRedisClient()
  if (client) {
    try {
      raw = await client.get(pendingKey(userId))
    } catch (err) {
      if (!loggedFallback) {
        loggedFallback = true
        console.warn('[redis-call-pending] GET failed; Map fallback', err)
      }
    }
  }
  if (raw == null) {
    const now = Date.now()
    pruneMemory(now)
    const entry = memory.get(pendingKey(userId))
    if (!entry || entry.expiresAt <= now) return null
    raw = entry.value
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as Partial<CallPendingPayload>
    if (!payload.callId || !payload.conversationId || !payload.fromUserId) return null
    if (payload.media !== 'audio' && payload.media !== 'video') return null
    return payload as CallPendingPayload
  } catch {
    return null
  }
}

/**
 * Clear the pending invite for a user — only when callId matches (or when
 * callId is omitted). Idempotent; wrong-callId calls are no-ops.
 */
export async function clearCallPending(
  userId: string,
  callId?: string,
): Promise<boolean> {
  if (callId) {
    const pending = await getCallPending(userId)
    if (!pending || pending.callId !== callId) return false
  }
  memory.delete(pendingKey(userId))
  const client = await getRedisClient()
  if (!client) return true
  try {
    await client.del(pendingKey(userId))
  } catch {
    /* ignore */
  }
  return true
}
