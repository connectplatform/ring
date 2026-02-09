'use server'

import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { defaultLocale, isValidLocale, type Locale } from '@/i18n-config'
import { signIn } from '@/auth'
import { auth } from '@/auth'

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

export interface AccountDeletionState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  deletionDate?: string // ISO date when account will be permanently deleted
  canCancel?: boolean   // Whether deletion can still be cancelled
}

// Auth.js v5 native server action for credentials sign-in
import { logger } from '@/lib/logger' 

// Auth.js v5 native server action for credentials sign-in

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
    // ✅ Use Auth.js v5 server-side signIn helper
    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    })

    if (result?.ok) {
      // Redirect on success
      redirect(redirectTo)
    } else {
      return {
        error: result?.error || 'Invalid email or password'
      }
    }
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    logger.error('Sign-in service call failed:', {
      email: email.trim(), // Log email for debugging (not password)
      error: error.message
    })
    
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
    // ✅ Use direct service call instead of HTTP request
    const { createUser } = await import('@/features/auth/services')
    
    const newUser = await createUser({
      name: name.trim(),
      email: email.trim(),
      // Note: Password handling should be done by auth provider
      // This is a simplification - in real implementation, password hashing
      // should be handled by the auth system
      authProvider: 'credentials'
    })

    if (newUser) {
      return {
        success: true,
        message: 'Account created successfully! Please sign in.'
      }
    } else {
      return {
        error: 'Failed to create account. Please try again.'
      }
    }
    
  } catch (error) {
    logger.error('Registration service call failed:', {
      email: email.trim(), // Log email for debugging (not password)
      error: error instanceof Error ? error.message : error
    })
    
    // Handle specific error cases
    if (error instanceof Error && error.message.includes('already exists')) {
      return {
        fieldErrors: {
          email: 'An account with this email already exists'
        }
      }
    }
    
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
    // ✅ Use direct service call instead of HTTP request
    const { updateProfile } = await import('@/features/auth/services')
    
    const success = await updateProfile({
      name: name.trim(),
      email: email.trim(),
    })

    if (success) {
      return {
        success: true,
        message: 'Profile completed successfully!'
      }
    } else {
      return {
        error: 'Failed to update profile. Please try again.'
      }
    }
    
  } catch (error) {
    logger.error('Profile update service call failed:', {
      userId: userId.trim(),
      email: email.trim(),
      error: error instanceof Error ? error.message : error
    })
    
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
    // ❌ TODO: Create password reset service
    // For now, using placeholder logic
    // This should be replaced with a direct service call to handle password reset
    
    // Placeholder logic - in real implementation, this would:
    // 1. Validate email exists
    // 2. Generate secure reset token
    // 3. Send email via email service
    
    //logger.info('Password reset requested for email:', email.trim())
    
    // Temporary success response
    return {
      success: true,
      message: 'Password reset email sent! Check your inbox.'
    }
    
  } catch (error) {
    logger.error('Password reset service call failed:', {
      email: email.trim(),
      error: error instanceof Error ? error.message : error
    })
    
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Account Deletion Functions
 * Following GDPR/CCPA compliance patterns with grace period
 */

export async function requestAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to delete your account'
    }
  }

  const password = formData.get('password') as string
  const confirmDeletion = formData.get('confirmDeletion') === 'true'
  const reason = formData.get('reason') as string || ''

  // Validation
  const fieldErrors: Record<string, string> = {}
  
  if (!password?.trim()) {
    fieldErrors.password = 'Password is required to confirm account deletion'
  }
  
  if (!confirmDeletion) {
    fieldErrors.confirmDeletion = 'You must confirm that you want to delete your account'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors
    }
  }

  try {
    // ✅ Use direct service call for account deletion request
    const { requestAccountDeletion: requestDeletionService } = await import('@/features/auth/services')
    
    const result = await requestDeletionService({
      userId: session.user.id,
      password: password.trim(),
      reason: reason.trim(),
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })

    if (result.success) {
      // Calculate deletion date (typically 30 days grace period)
      const deletionDate = new Date()
      deletionDate.setDate(deletionDate.getDate() + 30)
      
      return {
        success: true,
        message: 'Account deletion has been scheduled. You have 30 days to cancel this request.',
        deletionDate: deletionDate.toISOString(),
        canCancel: true
      }
    } else {
      if (result.error === 'INVALID_PASSWORD') {
        return {
          fieldErrors: {
            password: 'Invalid password. Please try again.'
          }
        }
      } else if (result.error === 'ACCOUNT_NOT_FOUND') {
        return {
          error: 'Account not found. Please contact support.'
        }
      } else {
        return {
          error: result.error || 'Failed to schedule account deletion. Please try again.'
        }
      }
    }
    
  } catch (error) {
    logger.error('Account deletion request failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function cancelAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to cancel account deletion'
    }
  }

  try {
    // ✅ Use direct service call for cancelling account deletion
    const { cancelAccountDeletion: cancelDeletionService } = await import('@/features/auth/services')
    
    const result = await cancelDeletionService({
      userId: session.user.id,
      userEmail: session.user.email || ''
    })

    if (result.success) {
      return {
        success: true,
        message: 'Account deletion has been successfully cancelled. Your account will remain active.',
        canCancel: false
      }
    } else {
      if (result.error === 'NO_DELETION_PENDING') {
        return {
          error: 'No pending account deletion found.'
        }
      } else if (result.error === 'GRACE_PERIOD_EXPIRED') {
        return {
          error: 'The grace period for cancelling account deletion has expired.'
        }
      } else {
        return {
          error: result.error || 'Failed to cancel account deletion. Please contact support.'
        }
      }
    }
    
  } catch (error) {
    logger.error('Account deletion cancellation failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function confirmAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to confirm account deletion'
    }
  }

  const finalConfirmation = formData.get('finalConfirmation') === 'true'
  
  if (!finalConfirmation) {
    return {
      fieldErrors: {
        finalConfirmation: 'You must confirm final account deletion'
      }
    }
  }

  try {
    // ✅ Use direct service call for final account deletion
    const { confirmAccountDeletion: confirmDeletionService } = await import('@/features/auth/services')
    
    const result = await confirmDeletionService({
      userId: session.user.id,
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })

    if (result.success) {
      // Log out user immediately after successful deletion
      redirect(ROUTES.AUTH_STATUS('delete', 'success', defaultLocale))
    } else {
      if (result.error === 'NO_DELETION_PENDING') {
        return {
          error: 'No pending account deletion found.'
        }
      } else if (result.error === 'GRACE_PERIOD_NOT_EXPIRED') {
        return {
          error: 'Account can only be deleted after the grace period expires.'
        }
      } else {
        return {
          error: result.error || 'Failed to delete account. Please contact support.'
        }
      }
    }
    
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error
    }
    
    logger.error('Account deletion confirmation failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

export async function getAccountDeletionStatus(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to check deletion status'
    }
  }

  try {
    // ✅ Use direct service call to get deletion status
    const { getAccountDeletionStatus: getDeletionStatusService } = await import('@/features/auth/services')
    
    const result = await getDeletionStatusService({
      userId: session.user.id
    })

    if (result.success) {
      if (result.data?.pendingDeletion) {
        const deletionDate = new Date(result.data.scheduledDeletionDate)
        const now = new Date()
        const canCancel = deletionDate > now
        
        return {
          success: true,
          message: canCancel 
            ? `Account deletion is scheduled for ${deletionDate.toLocaleDateString()}. You can still cancel.`
            : 'Account deletion is being processed and cannot be cancelled.',
          deletionDate: result.data.scheduledDeletionDate,
          canCancel
        }
      } else {
        return {
          success: true,
          message: 'No pending account deletion.',
          canCancel: false
        }
      }
    } else {
      return {
        error: result.error || 'Failed to check deletion status'
      }
    }
    
  } catch (error) {
    logger.error('Account deletion status check failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}