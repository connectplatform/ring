'use server'

import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { defaultLocale, isValidLocale, type Locale } from '@/i18n-config'

export interface AuthFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export interface UserProfileFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export interface GoogleSignInState {
  success?: boolean
  message?: string
  error?: string
}

export async function signInWithCredentials(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string || ROUTES.HOME(defaultLocale)

  // Validation
  const fieldErrors: Record<string, string> = {}
  
  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }
  
  if (!password?.trim()) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors
    }
  }

  try {
    // For now, redirect to the API route to handle authentication
    // This avoids circular dependency issues
    const response = await fetch(`${process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL}/api/auth/signin/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
        redirectTo,
      }),
    })

    if (!response.ok) {
      return {
        error: 'Invalid email or password'
      }
    }

    // Redirect on success
    redirect(redirectTo)
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    return {
      error: 'Something went wrong. Please try again.'
    }
  }
}

export async function signInWithProvider(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const provider = formData.get('provider') as string
  const redirectTo = formData.get('redirectTo') as string || ROUTES.HOME(defaultLocale)

  if (!provider || !['google', 'apple', 'metamask'].includes(provider)) {
    return {
      error: 'Invalid provider'
    }
  }

  try {
    // Handle MetaMask differently since it's not a standard OAuth provider
    if (provider === 'metamask') {
      // For MetaMask, we'll need to handle client-side wallet connection
      // For now, redirect to a MetaMask connection page
      redirect(`/auth/metamask?callbackUrl=${encodeURIComponent(redirectTo)}`)
    } else {
      // Redirect to standard OAuth provider sign-in
      redirect(`/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(redirectTo)}`)
    }
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    return {
      error: 'Failed to sign in with provider. Please try again.'
    }
  }
}

export async function signInWithGoogle(
  prevState: GoogleSignInState | null,
  formData: FormData
): Promise<GoogleSignInState> {
  const redirectUrl = formData.get('redirectUrl') as string
  const localeParam = formData.get('locale') as string || defaultLocale
  
  // Auth.js v5 & React 19: Validate locale type safety
  const locale: Locale = isValidLocale(localeParam) ? localeParam : defaultLocale
  const callbackUrl = redirectUrl || ROUTES.PROFILE(locale)

  try {
    // Redirect to Google OAuth sign-in
    redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    return {
      error: 'Failed to sign in with Google. Please try again.'
    }
  }
}

export async function registerUser(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const agreeToTerms = formData.get('agreeToTerms') === 'true'

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
  
  if (!password?.trim()) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters'
  }
  
  if (!confirmPassword?.trim()) {
    fieldErrors.confirmPassword = 'Please confirm your password'
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match'
  }
  
  if (!agreeToTerms) {
    fieldErrors.agreeToTerms = 'You must agree to the terms and conditions'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors
    }
  }

  try {
    // Create user account
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      if (response.status === 409) {
        return {
          fieldErrors: {
            email: 'An account with this email already exists'
          }
        }
      }
      
      return {
        error: errorData.message || 'Failed to create account. Please try again.'
      }
    }

    return {
      success: true,
      message: 'Account created successfully! Please sign in.'
    }
    
  } catch (error) {
    console.error('Error registering user:', error)
        return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function completeUserProfile(
  prevState: UserProfileFormState | null,
  formData: FormData
): Promise<UserProfileFormState> {
  const userId = formData.get('userId') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const action = formData.get('action') as string

  // Handle Google account linking
  if (action === 'link-google') {
    try {
      // Redirect to Google OAuth linking
      redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/profile')}`)
    } catch (error: any) {
      if (error.message?.includes('NEXT_REDIRECT')) {
        throw error
      }
      return {
        error: 'Failed to link Google account. Please try again.'
      }
    }
  }

  // Validation for profile completion
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
    // Update user profile via API
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/profile`, {
      method: 'PUT',
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
        error: errorData.message || 'Failed to update profile. Please try again.'
      }
    }

    return {
      success: true,
      message: 'Profile completed successfully!'
    }
    
  } catch (error) {
    console.error('Error completing user profile:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function linkGoogleAccount(
  prevState: UserProfileFormState | null,
  formData: FormData
): Promise<UserProfileFormState> {
  const userId = formData.get('userId') as string

  if (!userId?.trim()) {
    return {
      error: 'User ID is required'
    }
  }

  try {
    // Redirect to Google OAuth linking with user context
    redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/profile')}&linkAccount=${userId}`)
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error
    }
    
    return {
      error: 'Failed to link Google account. Please try again.'
    }
  }
} 

export async function requestPasswordReset(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get('email') as string

  // Validation
  if (!email?.trim()) {
    return {
      fieldErrors: {
        email: 'Email is required'
      }
    }
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return {
      fieldErrors: {
        email: 'Please enter a valid email address'
      }
    }
  }

  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: errorData.message || 'Failed to send reset email. Please try again.'
      }
    }

    return {
      success: true,
      message: 'Password reset email sent! Check your inbox.'
    }
    
  } catch (error) {
    console.error('Error requesting password reset:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 