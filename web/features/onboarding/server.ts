import 'server-only'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { isValidIsoBirthDate, type OnboardingSegmentId } from './types'

/**
 * Pending onboarding segments for the current session user, in render order.
 * Empty for guests / fully-onboarded users — the gate renders nothing.
 */
export async function getUserOnboardingPendingSegments(): Promise<OnboardingSegmentId[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  try {
    const result = await db().findDocById<{ birthDate?: string }>('users', session.user.id)
    if (!result.success || !result.data) return []

    const data = result.data as { birthDate?: string }
    const pending: OnboardingSegmentId[] = []
    if (!isValidIsoBirthDate(data.birthDate)) pending.push('date-of-birth')
    return pending
  } catch (error) {
    console.error('[onboarding] failed to read pending segments:', error)
    return []
  }
}
