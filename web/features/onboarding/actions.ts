'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { isValidIsoBirthDate, type IsoDateString, type SaveOnboardingSegmentResult } from './types'

/**
 * Persist one onboarding segment value onto the user profile.
 * `users.update` is a shallow JSONB merge — sibling profile fields are safe.
 */
export async function saveOnboardingSegment(
  segmentId: 'date-of-birth',
  value: IsoDateString
): Promise<SaveOnboardingSegmentResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Not authenticated' }
  }

  if (segmentId !== 'date-of-birth') {
    return { success: false, error: 'Unknown segment' }
  }
  if (!isValidIsoBirthDate(value)) {
    return { success: false, error: 'Invalid date of birth' }
  }

  try {
    const result = await db().updateDoc('users', session.user.id, {
      birthDate: value,
      updatedAt: new Date(),
    })
    if (!result.success) {
      throw result.error || new Error('Failed to update profile')
    }
    // Layout gate re-renders on next navigation; refresh pending state now.
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('[onboarding] failed to save segment:', error)
    return { success: false, error: 'Failed to save. Please try again.' }
  }
}
