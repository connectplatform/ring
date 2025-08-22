'use server'

import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { defaultLocale, isValidLocale, type Locale } from '@/i18n-config'
import { apiClient, ApiClientError, type ApiResponse } from '@/lib/api-client'

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
    // Use API client for auth with timeout and retry protection
    const response: ApiResponse = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/auth/signin/credentials`, {
      email: email.trim(),
      password,
      redirectTo,
    }, {
      timeout: 15000, // 15 second timeout for auth operations
      retries: 1 // Retry once for critical auth flow
    })

    if (response.success) {
      // Redirect on success
      redirect(redirectTo)
    } else {
      return {
        error: response.error || 'Invalid email or password'
      }
    }
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    if (error instanceof ApiClientError) {
      console.error('Sign-in API call failed:', {
        endpoint: '/api/auth/signin/credentials',
        statusCode: error.statusCode,
        context: error.context,
        email: email.trim() // Log email for debugging (not password)
      })
      
      // Return user-friendly error based on status code
      if (error.statusCode === 401 || error.statusCode === 403) {
        return { error: 'Invalid email or password' }
      } else if (error.statusCode === 429) {
        return { error: 'Too many login attempts. Please try again later.' }
      } else {
        return { error: 'Authentication service unavailable. Please try again.' }
      }
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
    // Create user account with API client timeout and retry protection
    const response: ApiResponse = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/auth/register`, {
      name: name.trim(),
      email: email.trim(),
      password,
    }, {
      timeout: 20000, // 20 second timeout for user creation
      retries: 1 // Retry once for account creation
    })

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Account created successfully! Please sign in.'
      }
    } else {
      return {
        error: response.error || 'Failed to create account. Please try again.'
      }
    }
    
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.error('Registration API call failed:', {
        endpoint: '/api/auth/register',
        statusCode: error.statusCode,
        context: error.context,
        email: email.trim() // Log email for debugging (not password)
      })
      
      // Handle specific error cases
      if (error.statusCode === 409) {
        return {
          fieldErrors: {
            email: 'An account with this email already exists'
          }
        }
      } else if (error.statusCode === 429) {
        return {
          error: 'Too many registration attempts. Please try again later.'
        }
      } else {
        return {
          error: error.message || 'Registration service unavailable. Please try again.'
        }
      }
    }
    
    console.error('Unexpected error registering user:', error)
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
    // Update user profile with API client timeout and retry protection
    const response: ApiResponse = await apiClient.put(`${process.env.NEXTAUTH_URL}/api/profile`, {
      userId: userId.trim(),
      name: name.trim(),
      email: email.trim(),
    }, {
      timeout: 10000, // 10 second timeout for profile updates
      retries: 2 // Retry twice for profile operations
    })

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Profile completed successfully!'
      }
    } else {
      return {
        error: response.error || 'Failed to update profile. Please try again.'
      }
    }
    
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.error('Profile update API call failed:', {
        endpoint: '/api/profile',
        statusCode: error.statusCode,
        context: error.context,
        userId: userId.trim(),
        email: email.trim()
      })
      
      // Handle specific error cases
      if (error.statusCode === 404) {
        return {
          error: 'User profile not found. Please sign in again.'
        }
      } else if (error.statusCode === 429) {
        return {
          error: 'Too many profile update attempts. Please try again later.'
        }
      } else {
        return {
          error: error.message || 'Profile service unavailable. Please try again.'
        }
      }
    }
    
    console.error('Unexpected error completing user profile:', error)
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
    // Send password reset with API client timeout and retry protection
    const response: ApiResponse = await apiClient.post(`${process.env.NEXTAUTH_URL}/api/auth/reset-password`, {
      email: email.trim(),
    }, {
      timeout: 15000, // 15 second timeout for email operations
      retries: 2 // Retry twice for password reset (important for UX)
    })

    if (response.success) {
      return {
        success: true,
        message: response.message || 'Password reset email sent! Check your inbox.'
      }
    } else {
      return {
        error: response.error || 'Failed to send reset email. Please try again.'
      }
    }
    
  } catch (error) {
    if (error instanceof ApiClientError) {
      console.error('Password reset API call failed:', {
        endpoint: '/api/auth/reset-password',
        statusCode: error.statusCode,
        context: error.context,
        email: email.trim()
      })
      
      // Handle specific error cases
      if (error.statusCode === 404) {
        return {
          error: 'No account found with this email address.'
        }
      } else if (error.statusCode === 429) {
        return {
          error: 'Too many reset requests. Please wait before trying again.'
        }
      } else {
        return {
          error: error.message || 'Password reset service unavailable. Please try again.'
        }
      }
    }
    
    console.error('Unexpected error requesting password reset:', error)
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
} 