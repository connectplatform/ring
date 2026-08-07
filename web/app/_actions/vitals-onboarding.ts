'use server'

import { auth } from '@/auth'
import type { Locale } from '@/i18n/shared'
import { logger } from '@/lib/logger'
import { userNeedsVitalsOnboarding } from '@/features/auth/lib/vitals-onboarding'
import { maybeAwardProfileRewards } from '@/lib/wallet/profile-reward-hooks'
import { db } from '@/lib/database'

export interface VitalsOnboardingFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Complete shared vitals onboarding after email magic/OTP or crypto-wallet/wagmi sign-in.
 */
export async function completeVitalsOnboarding(
  prevState: VitalsOnboardingFormState | null,
  formData: FormData,
  _locale: Locale,
): Promise<VitalsOnboardingFormState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Authentication required' }
  }

  const userId = session.user.id
  // Session may omit provider on older JWTs — infer from email presence
  const provider =
    session.user.provider ||
    (session.user.email ? 'email-magic' : 'crypto-wallet')
  const name = String(formData.get('name') || '')
  const emailRaw = String(formData.get('email') || '')
  const photoURL = String(formData.get('photoURL') || '').trim()

  const fieldErrors: Record<string, string> = {}
  if (!name?.trim()) {
    fieldErrors.name = 'Name is required'
  }

  const needsEmail = provider === 'crypto-wallet' || !session.user.email
  if (needsEmail) {
    if (!emailRaw.trim()) {
      fieldErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(emailRaw.trim())) {
      fieldErrors.email = 'Please enter a valid email address'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const email = needsEmail
    ? emailRaw.trim()
    : session.user.email || emailRaw.trim()

  try {
    let before: Record<string, unknown> | null = null
    try {
      const existing = await db().readDoc<Record<string, unknown>>('users', userId)
      if (existing.success && existing.data) {
        before = existing.data as Record<string, unknown>
      }
    } catch {
      /* non-fatal */
    }

    const { updateProfile } = await import('@/features/auth/services')
    const patch: Record<string, string> = {
      name: name.trim(),
      email,
    }
    if (photoURL) {
      patch.photoURL = photoURL
      patch.image = photoURL
    }

    const success = await updateProfile(patch as any)
    if (!success) {
      return { error: 'Failed to complete onboarding. Please try again.' }
    }

    const after = { ...(before || {}), ...patch, id: userId }
    await maybeAwardProfileRewards({
      userId,
      before,
      after,
      userRole: session.user.role,
    })

    if (
      userNeedsVitalsOnboarding(
        { name: patch.name, email: patch.email, photoURL: photoURL || null },
        provider,
      )
    ) {
      return { error: 'Please complete the required fields.' }
    }

    return {
      success: true,
      message: 'Profile completed successfully! Welcome to Ring.',
    }
  } catch (error) {
    logger.error('Vitals onboarding failed:', {
      userId,
      provider,
      error: error instanceof Error ? error.message : error,
    })
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
