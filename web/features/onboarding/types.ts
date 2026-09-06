/**
 * User-segment onboarding — shared types.
 *
 * A "segment" is one dedicated onboarding screen for one subset of profile
 * data (date of birth, names, preferences, …). Segments are shown to any
 * authenticated user whose profile is missing that subset.
 */

export const ONBOARDING_SEGMENT_IDS = ['date-of-birth'] as const

export type OnboardingSegmentId = (typeof ONBOARDING_SEGMENT_IDS)[number]

/** ISO calendar date `YYYY-MM-DD` (the canonical profile storage format). */
export type IsoDateString = string

export function isValidIsoBirthDate(value: unknown): value is IsoDateString {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  if (d.toISOString().slice(0, 10) !== value) return false
  const year = Number(value.slice(0, 4))
  const nowYear = new Date().getUTCFullYear()
  return year >= nowYear - 120 && year <= nowYear
}

/** Compose `YYYY-MM-DD` from roller parts (0-based month). */
export function toIsoBirthDate(year: number, month0: number, day: number): IsoDateString {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export interface SaveOnboardingSegmentResult {
  success: boolean
  error?: string
}
