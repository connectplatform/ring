import {
  CURTAIN_MAX_IMPRESSIONS_PER_DAY,
  CURTAIN_NOT_TODAY_MS,
} from '@/features/curtain/constants'
import type { CurtainOfferPref } from '@/features/curtain/types'

export function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function isOfferSuppressed(pref: CurtainOfferPref | undefined, now = Date.now()): boolean {
  if (!pref) return false
  if (pref.suppress === 'forever') return true
  if (pref.suppress === 'until' && typeof pref.until === 'number' && pref.until > now) {
    return true
  }
  return false
}

export function impressionsUsedToday(
  pref: CurtainOfferPref | undefined,
  now = Date.now(),
): number {
  if (!pref) return 0
  if (pref.impressionDay !== utcDayKey(now)) return 0
  return pref.impressionsToday ?? 0
}

export function canShowOffer(
  pref: CurtainOfferPref | undefined,
  now = Date.now(),
  maxPerDay = CURTAIN_MAX_IMPRESSIONS_PER_DAY,
): boolean {
  if (isOfferSuppressed(pref, now)) return false
  return impressionsUsedToday(pref, now) < maxPerDay
}

export function applyNotForMe(prev: CurtainOfferPref | undefined): CurtainOfferPref {
  return { ...prev, suppress: 'forever', until: undefined }
}

export function applyNotToday(prev: CurtainOfferPref | undefined, now = Date.now()): CurtainOfferPref {
  return { ...prev, suppress: 'until', until: now + CURTAIN_NOT_TODAY_MS }
}

export function recordImpression(prev: CurtainOfferPref | undefined, now = Date.now()): CurtainOfferPref {
  const day = utcDayKey(now)
  const used = prev?.impressionDay === day ? prev.impressionsToday ?? 0 : 0
  return {
    ...prev,
    impressionDay: day,
    impressionsToday: used + 1,
  }
}
