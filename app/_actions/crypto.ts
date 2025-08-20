'use server'

import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'

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
  const userId = formData.get('userId') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  // Validation
  const fieldErrors: Record<string, string> = {}
  
  if (!userId?.trim()) {
    return {
      error: 'User ID is required'
    }
  }
  
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

  try {
    // Update user profile via Firebase
    // Note: In server actions, we need to use Firebase Admin SDK
    // For now, we'll use an API route to handle Firebase updates
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/crypto/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId.trim(),
        name: name.trim(),
        email: email.trim(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: errorData.message || 'Failed to complete onboarding. Please try again.'
      }
    }

    return {
      success: true,
      message: 'Profile completed successfully! Welcome to Ring.'
    }
    
  } catch (error) {
    console.error('Error completing crypto onboarding:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 