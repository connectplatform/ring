import 'server-only'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { getRequiredOnboardingSegments, isProfileFieldSatisfied } from './required-fields'
import type { OnboardingSegmentId } from './types'

/**
 * Pending onboarding segments for the current session user, in render order.
 * Empty for guests, clones with no required fields, or fully-onboarded users.
 */
export async function getUserOnboardingPendingSegments(): Promise<OnboardingSegmentId[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const required = getRequiredOnboardingSegments()
  if (required.length === 0) return []

  try {
    const result = await db().findDocById<{ birthDate?: string }>('users', session.user.id)
    if (!result.success || !result.data) return []

    const data = result.data as { birthDate?: string }
    return required.filter((id) => !isProfileFieldSatisfied(id, data))
  } catch (error) {
    console.error('[onboarding] failed to read pending segments:', error)
    return []
  }
}
