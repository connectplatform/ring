import {
  CURTAIN_ATTR_COOKIE,
  CURTAIN_ATTR_COOKIE_MAX_CHARS,
  CURTAIN_ATTR_MAX_AGE_SECONDS,
  CURTAIN_ATTR_MAX_TOUCHES,
  CURTAIN_ATTR_PATH_MAX,
  CURTAIN_ATTR_STORAGE_KEY,
} from '@/features/curtain/constants'
import type { CurtainAttributionTouch } from '@/features/curtain/types'

const WINDOW_MS = CURTAIN_ATTR_MAX_AGE_SECONDS * 1000

export type ParseCurtainAttributionOptions = {
  /** Default true for cookies/localStorage. Stamped order payloads must pass false. */
  applyWindow?: boolean
}

export function parseCurtainAttributionJson(
  raw: string | null | undefined,
  opts?: ParseCurtainAttributionOptions,
): CurtainAttributionTouch[] {
  if (!raw?.trim()) return []
  const candidates = [raw]
  try {
    if (raw.includes('%')) candidates.push(decodeURIComponent(raw))
  } catch {
    /* malformed encoding */
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { touches?: unknown }).touches)
          ? (parsed as { touches: unknown[] }).touches
          : []
      return normalizeTouchList(list, opts)
    } catch {
      continue
    }
  }
  return []
}

export function touchesFromUnknown(
  raw: unknown,
  opts?: ParseCurtainAttributionOptions,
): CurtainAttributionTouch[] {
  if (raw == null) return []
  if (typeof raw === 'string') return parseCurtainAttributionJson(raw, opts)
  if (Array.isArray(raw)) return normalizeTouchList(raw, opts)
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { touches?: unknown }).touches)) {
    return normalizeTouchList((raw as { touches: unknown[] }).touches, opts)
  }
  return []
}

function normalizeTouchList(
  list: unknown[],
  opts?: ParseCurtainAttributionOptions,
): CurtainAttributionTouch[] {
  const applyWindow = opts?.applyWindow !== false
  const now = Date.now()
  return list
    .map((row) => normalizeTouch(row))
    .filter((row): row is CurtainAttributionTouch => {
      if (!row) return false
      if (!applyWindow) return true
      return now - row.ctaAt < WINDOW_MS
    })
}

function normalizeTouch(row: unknown): CurtainAttributionTouch | null {
  if (!row || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const productId = typeof rec.productId === 'string' ? rec.productId : ''
  const offerId = typeof rec.offerId === 'string' ? rec.offerId : ''
  const ctaAt = typeof rec.ctaAt === 'number' ? rec.ctaAt : Number(rec.ctaAt)
  const commissionPercent = Number(rec.commissionPercent)
  if (!productId || !offerId || !Number.isFinite(ctaAt)) return null
  return {
    offerId,
    productId,
    authorUserId: typeof rec.authorUserId === 'string' ? rec.authorUserId : undefined,
    pagePath: typeof rec.pagePath === 'string' ? rec.pagePath : undefined,
    commissionPercent: Number.isFinite(commissionPercent) ? commissionPercent : 0,
    ctaAt,
  }
}

export function compactCurtainTouches(touches: CurtainAttributionTouch[]): CurtainAttributionTouch[] {
  const now = Date.now()
  const windowed = touches.filter((row) => now - row.ctaAt < WINDOW_MS)
  const byProduct = new Map<string, CurtainAttributionTouch>()
  for (const touch of windowed) {
    const prev = byProduct.get(touch.productId)
    if (!prev || touch.ctaAt > prev.ctaAt) byProduct.set(touch.productId, touch)
  }
  return [...byProduct.values()]
    .sort((a, b) => b.ctaAt - a.ctaAt)
    .slice(0, CURTAIN_ATTR_MAX_TOUCHES)
    .map((touch) => ({
      ...touch,
      pagePath: touch.pagePath ? touch.pagePath.slice(0, CURTAIN_ATTR_PATH_MAX) : undefined,
    }))
    .sort((a, b) => a.ctaAt - b.ctaAt)
}

export function mergeTouchLists(...lists: CurtainAttributionTouch[][]): CurtainAttributionTouch[] {
  return compactCurtainTouches(lists.flat())
}

export function mergeCurtainTouch(
  existing: CurtainAttributionTouch[],
  next: CurtainAttributionTouch,
): CurtainAttributionTouch[] {
  return compactCurtainTouches([...existing, next])
}

export function serializeCurtainAttribution(touches: CurtainAttributionTouch[]): string {
  return JSON.stringify(compactCurtainTouches(touches))
}

function cookieSafePayload(touches: CurtainAttributionTouch[]): string {
  let list = compactCurtainTouches(touches)
  let json = JSON.stringify(list)
  while (encodeURIComponent(json).length > CURTAIN_ATTR_COOKIE_MAX_CHARS && list.length > 1) {
    list = list.slice(1)
    json = JSON.stringify(list)
  }
  return json
}

export function readCurtainAttributionClient(): CurtainAttributionTouch[] {
  if (typeof window === 'undefined') return []
  const fromStorage = window.localStorage.getItem(CURTAIN_ATTR_STORAGE_KEY)
  const fromCookie = readCookie(CURTAIN_ATTR_COOKIE)
  return mergeTouchLists(
    parseCurtainAttributionJson(fromStorage),
    parseCurtainAttributionJson(fromCookie),
  )
}

export function writeCurtainAttributionClient(touches: CurtainAttributionTouch[]): void {
  if (typeof window === 'undefined') return
  const compact = compactCurtainTouches(touches)
  const storagePayload = JSON.stringify(compact)
  try {
    window.localStorage.setItem(CURTAIN_ATTR_STORAGE_KEY, storagePayload)
  } catch {
    /* private mode */
  }
  const cookiePayload = cookieSafePayload(compact)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CURTAIN_ATTR_COOKIE}=${encodeURIComponent(cookiePayload)}; path=/; max-age=${CURTAIN_ATTR_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? match[1] : null
}

export function touchesForProductIds(
  touches: CurtainAttributionTouch[],
  productIds: string[],
): CurtainAttributionTouch[] {
  const set = new Set(productIds)
  return touches.filter((touch) => set.has(touch.productId))
}
