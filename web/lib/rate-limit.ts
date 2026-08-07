const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

type Key = string

const store = new Map<Key, { count: number; resetAt: number }>()

export function rateLimit(key: Key, max: number = MAX_REQUESTS, windowMs: number = WINDOW_MS): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { ok: true, remaining: max - 1, resetAt }
  }
  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count += 1
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

export function keyFromRequest(req: Request, userId?: string): string {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '')
  return `${userId || 'anon'}:${ip}`
}


