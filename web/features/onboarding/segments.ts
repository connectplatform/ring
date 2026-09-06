/**
 * User-segment onboarding — segment registry.
 *
 * Each segment owns exactly one data subset and one dedicated screen. Add a
 * segment here + a screen in `components/screens/` + the gate renders it
 * automatically for any authenticated user missing that subset.
 */

import type { OnboardingSegmentId } from './types'

export interface OnboardingSegmentDef {
  id: OnboardingSegmentId
  titleKey: string
  descriptionKey: string
  /** localStorage key for the "maybe later" snooze (7 days). */
  snoozeKey: string
}

export const ONBOARDING_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export const ONBOARDING_SEGMENTS: Record<OnboardingSegmentId, OnboardingSegmentDef> = {
  'date-of-birth': {
    id: 'date-of-birth',
    // Full keys under the `modules.onboarding` namespace (camelCase JSON keys).
    titleKey: 'dateOfBirth.title',
    descriptionKey: 'dateOfBirth.description',
    snoozeKey: 'ring_onboarding_snooze_date-of-birth',
  },
}
