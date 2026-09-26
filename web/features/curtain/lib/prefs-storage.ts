import { CURTAIN_PREFS_STORAGE_KEY } from '@/features/curtain/constants'
import type { CurtainOfferPref, CurtainPrefsDoc } from '@/features/curtain/types'

const EMPTY: CurtainPrefsDoc = { offers: {}, updatedAt: new Date(0).toISOString() }

export function parseCurtainPrefs(raw: unknown): CurtainPrefsDoc {
  if (!raw || typeof raw !== 'object') return { ...EMPTY, offers: {} }
  const rec = raw as Record<string, unknown>
  const offersIn = rec.offers && typeof rec.offers === 'object' ? (rec.offers as Record<string, unknown>) : {}
  const offers: Record<string, CurtainOfferPref> = {}
  for (const [id, value] of Object.entries(offersIn)) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    offers[id] = {
      suppress: row.suppress === 'forever' || row.suppress === 'until' ? row.suppress : undefined,
      until: typeof row.until === 'number' ? row.until : undefined,
      impressionsToday: typeof row.impressionsToday === 'number' ? row.impressionsToday : undefined,
      impressionDay: typeof row.impressionDay === 'string' ? row.impressionDay : undefined,
    }
  }
  return {
    offers,
    updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : new Date().toISOString(),
  }
}

export function mergeCurtainPrefs(local: CurtainPrefsDoc, remote: CurtainPrefsDoc): CurtainPrefsDoc {
  const offers: Record<string, CurtainOfferPref> = { ...remote.offers }
  for (const [id, pref] of Object.entries(local.offers)) {
    const other = offers[id]
    offers[id] = strongerPref(other, pref)
  }
  const localTs = Date.parse(local.updatedAt) || 0
  const remoteTs = Date.parse(remote.updatedAt) || 0
  return {
    offers,
    updatedAt: new Date(Math.max(localTs, remoteTs, Date.now())).toISOString(),
  }
}

function strongerPref(a?: CurtainOfferPref, b?: CurtainOfferPref): CurtainOfferPref {
  const forever = a?.suppress === 'forever' || b?.suppress === 'forever'
  const until = Math.max(a?.until ?? 0, b?.until ?? 0)
  const day = (a?.impressionDay || '') >= (b?.impressionDay || '') ? a?.impressionDay : b?.impressionDay
  const impressions =
    a?.impressionDay === b?.impressionDay
      ? Math.max(a?.impressionsToday ?? 0, b?.impressionsToday ?? 0)
      : day === a?.impressionDay
        ? a?.impressionsToday
        : b?.impressionsToday
  return {
    suppress: forever ? 'forever' : until > Date.now() ? 'until' : undefined,
    until: forever ? undefined : until || undefined,
    impressionDay: day,
    impressionsToday: impressions,
  }
}

export function readCurtainPrefsClient(): CurtainPrefsDoc {
  if (typeof window === 'undefined') return { ...EMPTY, offers: {} }
  try {
    return parseCurtainPrefs(JSON.parse(window.localStorage.getItem(CURTAIN_PREFS_STORAGE_KEY) || 'null'))
  } catch {
    return { ...EMPTY, offers: {} }
  }
}

export function writeCurtainPrefsClient(doc: CurtainPrefsDoc): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CURTAIN_PREFS_STORAGE_KEY, JSON.stringify(doc))
  } catch {
    /* private mode */
  }
}

export function patchOfferPref(
  doc: CurtainPrefsDoc,
  offerId: string,
  next: CurtainOfferPref,
): CurtainPrefsDoc {
  return {
    offers: { ...doc.offers, [offerId]: next },
    updatedAt: new Date().toISOString(),
  }
}
