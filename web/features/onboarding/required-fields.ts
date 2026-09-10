/**
 * ring-config → onboarding gate SSOT.
 *
 * `user.requiredProfileFields` lists OnboardingSegmentId values the fs-modal
 * may require. Empty / omitted / unknown ids → nothing required (DOB optional).
 */

import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { isValidIsoBirthDate, ONBOARDING_SEGMENT_IDS, type OnboardingSegmentId } from './types'

type ProfileSnapshot = { birthDate?: string }

const PROFILE_FIELD_SATISFIED: Record<
  OnboardingSegmentId,
  (data: ProfileSnapshot) => boolean
> = {
  'date-of-birth': (data) => isValidIsoBirthDate(data.birthDate),
}

/** Pure parse — empty unless the id is a known onboarding segment. */
export function resolveRequiredProfileFields(raw: unknown): OnboardingSegmentId[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<OnboardingSegmentId>()
  const out: OnboardingSegmentId[] = []
  for (const id of raw) {
    if (typeof id !== 'string') continue
    if (!(ONBOARDING_SEGMENT_IDS as readonly string[]).includes(id)) continue
    const segment = id as OnboardingSegmentId
    if (seen.has(segment)) continue
    seen.add(segment)
    out.push(segment)
  }
  return out
}

export function isProfileFieldSatisfied(
  id: OnboardingSegmentId,
  data: ProfileSnapshot,
): boolean {
  return PROFILE_FIELD_SATISFIED[id](data)
}

/** Clone-required segments from ring-config `user.requiredProfileFields`. */
export function getRequiredOnboardingSegments(): OnboardingSegmentId[] {
  return resolveRequiredProfileFields(getSystemConfigSnapshot().user?.requiredProfileFields)
}
