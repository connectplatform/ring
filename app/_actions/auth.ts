'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing, type Locale } from '@/i18n/routing'
import { signIn, auth } from '@/auth'
import {
  getOAuthIntentCookieOptions,
  OAUTH_INTENT_COOKIE_NAME,
  resolveOAuthIntentRole,
} from '@/features/auth/role-intent'

// State interfaces for form actions
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

import { logger } from '@/lib/logger'

// Helper: Set OAuth role intent into cookie
async function setOAuthIntentCookie(rawRole: FormDataEntryValue | null) {
  const cookieStore = await cookies()
  const role = resolveOAuthIntentRole(rawRole)
  cookieStore.set(OAUTH_INTENT_COOKIE_NAME, role, getOAuthIntentCookieOptions())
  return role
}

// Helper: Clear the OAuth role intent from cookie
async function clearOAuthIntentCookie() {
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_INTENT_COOKIE_NAME, '', {
    ...getOAuthIntentCookieOptions(),
    maxAge: 0,
  })
}

/**
 * Credentials-based Sign-In
 */
export async function signInWithCredentials(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  // TODO: If you use React 19 Server Actions with progressive enhancement,
  // consider extracting form value access into a custom hook/client schema parser.

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string || ROUTES.HOME(routing.defaultLocale)

  const fieldErrors: Record<string, string> = {}

  // Email validation
  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }

  // Password validation
  if (!password?.trim()) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters'
  }

  if (Object.keys(fieldErrors).length > 0) {
    // Return immediately if validation fails
    return { fieldErrors }
  }

  try {
    // Use next-auth Auth.js V5 signIn helper
    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    })

    if (result?.ok) {
      // On successful sign in, redirect user
      redirect(redirectTo)
    } else {
      // Generic error message or specific error if available
      return {
        error: result?.error || 'Invalid email or password'
      }
    }
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      // Handle Next.js redirect errors by rethrowing them
      throw error
    }

    logger.error('Sign-in service call failed:', {
      email: email.trim(),
      error: error.message
    })

    return {
      error: 'Something went wrong. Please try again.'
    }
  }
}

/**
 * OAuth Provider Sign-In (Google, Apple, Metamask)
 */
export async function signInWithProvider(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  // TODO: Add detection for future providers with a central provider list.

  const provider = formData.get('provider') as string
  const redirectTo = formData.get('redirectTo') as string || ROUTES.HOME(routing.defaultLocale)

  // Validate supported providers
  if (!provider || !['google', 'apple', 'metamask'].includes(provider)) {
    return { error: 'Invalid provider' }
  }

  // Special: Metamask handled via dedicated auth route
  if (provider === 'metamask') {
    redirect(`/auth/metamask?callbackUrl=${encodeURIComponent(redirectTo)}`)
  }

  try {
    // Set OAuth intent cookie before redirect to provider
    await setOAuthIntentCookie(formData.get('intent') ?? formData.get('role'))
  } catch {
    return { error: 'Failed to sign in with provider. Please try again.' }
  }

  // Finalize: redirect to provider login endpoint
  redirect(`/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent(redirectTo)}`)
}

/**
 * Google Sign-In (explicit Google workflow with locale)
 */
export async function signInWithGoogle(
  prevState: GoogleSignInState | null,
  formData: FormData
): Promise<GoogleSignInState> {
  // TODO: For universal OAuth flows, consolidate and dedupe provider-specific logic.

  const redirectUrl = formData.get('redirectUrl') as string
  const localeParam = formData.get('locale') as string || routing.defaultLocale

  // Ensure type safety for locale (prevents passing a bad value to routing)
  const locale: Locale = routing.locales.includes(localeParam as Locale) ? (localeParam as Locale) : routing.defaultLocale
  const callbackUrl = redirectUrl || ROUTES.PROFILE(locale)

  try {
    await setOAuthIntentCookie(formData.get('intent') ?? formData.get('role'))
  } catch {
    return { error: 'Failed to sign in with Google. Please try again.' }
  }

  redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`)
}

/**
 * Registration (Credentials, not OAuth)
 */
export async function registerUser(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  // SSOT: inline validation with fieldErrors map is the established pattern

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const agreeToTerms = formData.get('agreeToTerms') === 'true'

  const fieldErrors: Record<string, string> = {}

  // Name validation
  if (!name?.trim()) fieldErrors.name = 'Name is required'

  // Email validation
  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }

  // Password validation
  if (!password?.trim()) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 8) {
    fieldErrors.password = 'Password must be at least 8 characters'
  }

  // Confirm password validation
  if (!confirmPassword?.trim()) {
    fieldErrors.confirmPassword = 'Please confirm your password'
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match'
  }

  // Must accept T&Cs
  if (!agreeToTerms) {
    fieldErrors.agreeToTerms = 'You must agree to the terms and conditions'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    // Dynamically import createUser service, so this code is only loaded server-side
    const { createUser } = await import('@/features/auth/services')

    // User registration
    const newUser = await createUser({
      name: name.trim(),
      email: email.trim(),
      // Note: Password is handled by auth provider, not directly stored here
      // TODO: Confirm password strength on backend
      authProvider: 'credentials'
    })

    if (newUser) {
      return {
        success: true,
        message: 'Account created successfully! Please sign in.'
      }
    } else {
      return { error: 'Failed to create account. Please try again.' }
    }
  } catch (error) {
    logger.error('Registration service call failed:', {
      email: email.trim(),
      error: error instanceof Error ? error.message : error
    })

    // Handle specific known errors
    if (error instanceof Error && error.message.includes('already exists')) {
      return {
        fieldErrors: { email: 'An account with this email already exists' }
      }
    }

    return {
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Profile completion (non-auth, user info updates)
 */
export async function completeUserProfile(
  prevState: UserProfileFormState | null,
  formData: FormData
): Promise<UserProfileFormState> {
  // TODO: Explore using React server actions "revalidatePath" for immediate cache consistency

  const userId = formData.get('userId') as string
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const action = formData.get('action') as string

  // Google account linking handled as a redirect
  if (action === 'link-google') {
    redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/profile')}`)
  }

  const fieldErrors: Record<string, string> = {}

  // User identification required
  if (!userId?.trim()) {
    return { error: 'User ID is required' }
  }

  // Name/email validation
  if (!name?.trim()) fieldErrors.name = 'Name is required'

  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    // Update profile service
    const { updateProfile } = await import('@/features/auth/services')

    const success = await updateProfile({
      name: name.trim(),
      email: email.trim(),
    })

    if (success) {
      // Revalidate profile paths for cache consistency (Next.js 16 pattern)
      const { revalidatePath } = await import('next/cache')
      revalidatePath('/[locale]/profile')
      revalidatePath('/[locale]/settings')
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

/**
 * Google account linking for an existing user (separate from login)
 */
export async function linkGoogleAccount(
  prevState: UserProfileFormState | null,
  formData: FormData
): Promise<UserProfileFormState> {
  const userId = formData.get('userId') as string

  // User identification required
  if (!userId?.trim()) {
    return { error: 'User ID is required' }
  }

  try {
    // Clear intent cookie to avoid role confusion on link
    await clearOAuthIntentCookie()
  } catch {
    return { error: 'Failed to link Google account. Please try again.' }
  }

  // Redirect triggers provider linking flow
  redirect(`/api/auth/signin/google?callbackUrl=${encodeURIComponent('/profile')}&linkAccount=${userId}`)
}

/**
 * Password reset request (forgot password)
 */
export async function requestPasswordReset(
  prevState: AuthFormState | null,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get('email') as string

  // Email must be valid, basic check
  if (!email?.trim()) {
    return { fieldErrors: { email: 'Email is required' } }
  }

  if (!/\S+@\S+\.\S+/.test(email)) {
    return { fieldErrors: { email: 'Please enter a valid email address' } }
  }

  try {
    // TODO: Replace placeholder logic with a real password reset service/action.
    // Ideally: 
    // - Validate email exists
    // - Generate reset token
    // - Dispatch email
    // - Track/reset attempt rate

    // Temporary placeholder always responds success
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
 * Account Deletion Flows (GDPR/CCPA: staged with grace periods)
 */

// Request deletion (starts process, sets grace period)
export async function requestAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  // SSOT: auth() session check at top of action is the established pattern

  const session = await auth()

  if (!session?.user?.id) {
    return { error: 'You must be logged in to delete your account' }
  }

  const password = formData.get('password') as string
  const confirmDeletion = formData.get('confirmDeletion') === 'true'
  const reason = formData.get('reason') as string || ''

  const fieldErrors: Record<string, string> = {}

  if (!password?.trim()) {
    fieldErrors.password = 'Password is required to confirm account deletion'
  }

  if (!confirmDeletion) {
    fieldErrors.confirmDeletion = 'You must confirm that you want to delete your account'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    const { requestAccountDeletion: requestDeletionService } = await import('@/features/auth/services')

    // Service expects session info and form data
    const result = await requestDeletionService({
      userId: session.user.id,
      password: password.trim(),
      reason: reason.trim(),
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })

    if (result.success) {
      // Compute a 30-day grace period deletion date
      const deletionDate = new Date()
      deletionDate.setDate(deletionDate.getDate() + 30)

      return {
        success: true,
        message: 'Account deletion has been scheduled. You have 30 days to cancel this request.',
        deletionDate: deletionDate.toISOString(),
        canCancel: true
      }
    } else {
      // Semantic error handling by known code
      if (result.error === 'INVALID_PASSWORD') {
        return { fieldErrors: { password: 'Invalid password. Please try again.' } }
      } else if (result.error === 'ACCOUNT_NOT_FOUND') {
        return { error: 'Account not found. Please contact support.' }
      } else {
        return { error: result.error || 'Failed to schedule account deletion. Please try again.' }
      }
    }
  } catch (error) {
    logger.error('Account deletion request failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })

    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// Cancel pending deletion within grace period
export async function cancelAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  // TODO: Assess if you can optimize with a single token-based confirmation

  const session = await auth()

  if (!session?.user?.id) {
    return { error: 'You must be logged in to cancel account deletion' }
  }

  try {
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
        return { error: 'No pending account deletion found.' }
      } else if (result.error === 'GRACE_PERIOD_EXPIRED') {
        return { error: 'The grace period for cancelling account deletion has expired.' }
      } else {
        return { error: result.error || 'Failed to cancel account deletion. Please contact support.' }
      }
    }
  } catch (error) {
    logger.error('Account deletion cancellation failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })

    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// Final confirmation of deletion (after grace period expired)
export async function confirmAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return { error: 'You must be logged in to confirm account deletion' }
  }

  const finalConfirmation = formData.get('finalConfirmation') === 'true'

  // Must explicitly opt-in for final deletion action (irreversible)
  if (!finalConfirmation) {
    return {
      fieldErrors: {
        finalConfirmation: 'You must confirm final account deletion'
      }
    }
  }

  try {
    const { confirmAccountDeletion: confirmDeletionService } = await import('@/features/auth/services')

    const result = await confirmDeletionService({
      userId: session.user.id,
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })

    if (result.success) {
      // Log out user and show deleted feedback screen
      redirect(ROUTES.AUTH_STATUS('delete', 'success', routing.defaultLocale))
    } else {
      if (result.error === 'NO_DELETION_PENDING') {
        return { error: 'No pending account deletion found.' }
      } else if (result.error === 'GRACE_PERIOD_NOT_EXPIRED') {
        return { error: 'Account can only be deleted after the grace period expires.' }
      } else {
        return { error: result.error || 'Failed to delete account. Please contact support.' }
      }
    }
  } catch (error: any) {
    if (error.message?.includes('NEXT_REDIRECT')) {
      throw error
    }

    logger.error('Account deletion confirmation failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })

    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

// Query if there's a pending account deletion, and time remaining
export async function getAccountDeletionStatus(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return { error: 'You must be logged in to check deletion status' }
  }

  try {
    const { getAccountDeletionStatus: getDeletionStatusService } = await import('@/features/auth/services')

    const result = await getDeletionStatusService({ userId: session.user.id })

    if (result.success) {
      if (result.data?.pendingDeletion) {
        // Compute whether user can still cancel by comparing current date with deletion date
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
      return { error: result.error || 'Failed to check deletion status' }
    }
  } catch (error) {
    logger.error('Account deletion status check failed:', {
      userId: session.user.id,
      userEmail: session.user.email,
      error: error instanceof Error ? error.message : error
    })

    return { error: 'An unexpected error occurred. Please try again.' }
  }
}