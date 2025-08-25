'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'
import { logger } from '@/lib/logger'

export interface CryptoOnboardingFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export async function completeCryptoOnboarding(
  prevState: CryptoOnboardingFormState | null,
  formData: FormData
): Promise<CryptoOnboardingFormState> {
  // Get current user session
  const session = await auth()
  if (!session?.user?.id) {
    return {
      error: 'Authentication required'
    }
  }

  const userId = session.user.id // Use session user ID for security
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  try {

    // Validation
    const fieldErrors: Record<string, string> = {}
    
    if (!name?.trim()) {
      fieldErrors.name = 'Name is required'
    }
    
    if (!email?.trim()) {
      fieldErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      fieldErrors.email = 'Please enter a valid email address'
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors
      }
    }
    // ✅ Use direct service call instead of HTTP request
    // Use the auth profile update service for crypto onboarding
    const { updateProfile } = await import('@/features/auth/services')
    
    const success = await updateProfile({
      name: name.trim(),
      email: email.trim(),
    })

    if (success) {
      return {
        success: true,
        message: 'Profile completed successfully! Welcome to Ring.'
      }
    } else {
      return {
        error: 'Failed to complete onboarding. Please try again.'
      }
    }
    
  } catch (error) {
    logger.error('Crypto onboarding service call failed:', {
      userId: session?.user?.id,
      email: session?.user?.email,
      error: error instanceof Error ? error.message : error
    })
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 