'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { db } from '@/lib/database'
import { isValidLocale, type Locale } from '@/lib/locale-config'
import { revalidatePath } from 'next/cache'

// Shape of responses for user form actions.
export interface UserFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Updates the logged-in user's application settings, such as theme, language preferences, and notification options.
 * Returns a result object describing the outcome or validation errors.
 * 
 * @param prevState Previous state object for rollback (not used in this implementation)
 * @param formData FormData of settings
 * @param locale Selected user locale (for redirect/revalidation)
 */
export async function updateUserSettings(
  prevState: UserFormState | null,
  formData: FormData,
  locale: Locale
): Promise<UserFormState> {

  // Get logged-in user's session.
  const session = await auth()
  
  if (!session?.user?.id) {
    // No user, must be authenticated to update settings.
    return {
      error: 'You must be logged in to update settings'
    }
  }

  // Extract submitted form fields.
  const theme = formData.get('theme') as string
  const language = formData.get('language') as string
  const notifications = formData.get('notifications') === 'on'
  const emailUpdates = formData.get('emailUpdates') === 'on'
  
  // ---- Validation ----

  // Validate theme value
  if (theme && !['light', 'dark', 'system'].includes(theme)) {
    return {
      fieldErrors: { theme: 'Invalid theme setting' }
    }
  }

  // Validate selected language (locale)
  if (language && !isValidLocale(language)) {
    return {
      fieldErrors: { language: 'Invalid language setting' }
    }
  }

  try {
    // Compose user settings update.
    const updateData = {
      settings: {
        theme,
        language,
        notifications,
        emailUpdates
      },
      updatedAt: new Date(),
    }

    // Actually update the settings document.
    const result = await db().updateDoc('users', session.user.id, updateData)
    if (!result.success) {
      // If update failed, throw or bubble up error.
      throw result.error || new Error('Failed to update settings')
    }
    
    // TODO: Replace deprecated or manual cache methods with React19/Next16's cache signal and cache hydration APIs as available.
    // Revalidate user profile route in Next.js app router (React 19 pattern).
    revalidatePath(`/[locale]/profile/${session.user.id}`)

    return {
      success: true,
      message: 'Settings updated successfully!'
    }
  } catch (error) {
    console.error('Error updating user settings:', error)
    return {
      error: 'Failed to update settings. Please try again.'
    }
  }
}

/**
 * Updates the logged-in user's profile (name, username, bio, social links, etc).
 * Handles reservation & confirmation of unique usernames, input validation, and relevant cache refresh.
 * 
 * @param prevState Previous form state (unused here)
 * @param formData Submitted profile form
 * @param locale User's locale/language
 */
export async function updateUserProfile(
  prevState: UserFormState | null,
  formData: FormData,
  locale: Locale
): Promise<UserFormState> {

  // Get current session and make sure user is authenticated.
  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update profile'
    }
  }

  // ---- Extract form data ----
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const username = (formData.get('username') as string | null)?.trim() || ''
  const bio = formData.get('bio') as string
  const company = formData.get('company') as string
  const position = formData.get('position') as string
  const location = formData.get('location') as string
  const website = formData.get('website') as string
  const linkedin = formData.get('linkedin') as string
  const twitter = formData.get('twitter') as string
  const github = formData.get('github') as string

  // ---- Synchronous validation: build up field errors ----
  const fieldErrors: Record<string, string> = {}

  // Username validation: 3-32 chars, only allowed characters
  if (username) {
    if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(username)) {
      fieldErrors.username = 'Username must be 3-32 characters and contain only letters, numbers, underscores, or hyphens'
    }
  }

  // Required fields validation
  if (!name?.trim()) {
    fieldErrors.name = 'Name is required'
  }

  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }

  // URL format validations
  if (website && !/^https?:\/\/.+\..+/.test(website)) {
    fieldErrors.website = 'Please enter a valid website URL'
  }

  if (linkedin && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(linkedin)) {
    fieldErrors.linkedin = 'Please enter a valid LinkedIn URL'
  }

  if (twitter && !/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+/.test(twitter)) {
    fieldErrors.twitter = 'Please enter a valid Twitter/X URL'
  }

  if (github && !/^https?:\/\/(www\.)?github\.com\/.+/.test(github)) {
    fieldErrors.github = 'Please enter a valid GitHub URL'
  }

  // If any errors found, halt and return them to client
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    // ---- Username uniqueness reservation (if username was provided) ----
    if (username) {
      // Convert username to lowercase for lookups (canonical).
      const usernameKey = username.toLowerCase()
      const RESERVATION_EXPIRY_MS = 5 * 60 * 1000 // 5 min window
      const now = new Date()
      const expiryTime = new Date(now.getTime() + RESERVATION_EXPIRY_MS)
      
      try {
        // Use atomic DB transaction to reserve usernames without race conditions.
        await db().transaction(async (txn) => {
          // Check if username exists and who owns it
          const usernameDoc = await txn.read('usernames', usernameKey)
          const userDoc = await txn.read('users', session.user.id)
          
          const currentUsername = userDoc ? (userDoc.data as any)?.username?.toLowerCase() : undefined
          
          // If username exists, ensure it's not permanently claimed by another user
          if (usernameDoc) {
            // If data is in .data prop or directly
            const reservationData = (usernameDoc.data ?? usernameDoc) as any
            const owner = reservationData.userId
            const reservedAt = reservationData.reservedAt ? new Date(reservationData.reservedAt) : null
            const confirmed = reservationData.confirmed || false
            
            if (owner !== session.user.id) {
              if (confirmed) {
                // Username was taken and confirmed
                throw new Error('Username is already taken')
              }
              // Username temporarily reserved by someone else (not confirmed/expired yet)
              if (reservedAt && (now.getTime() - reservedAt.getTime()) < RESERVATION_EXPIRY_MS) {
                throw new Error('Username is temporarily reserved by another user')
              }
              // If reservation expired, allow current user to claim it, but notify in logs
              console.log(`Username ${usernameKey} reservation expired, releasing for new user`)
            }
          }
          
          // The user is changing from a previous username - release old map if needed
          if (currentUsername && currentUsername !== usernameKey) {
            await txn.delete('usernames', currentUsername)
          }
          
          // Reserve new username with pending confirmation
          await txn.create(
            'usernames',
            {
              userId: session.user.id,
              username: username, // preserve original case
              reservedAt: now,
              confirmedAt: null, // Will be set once confirmed
              confirmed: false, // true only after profile successfully updated
              expiresAt: expiryTime,
              updatedAt: now
            },
            { id: usernameKey }
          )
          
          // Update user doc to record only a temporary username assignment
          await txn.update('users', session.user.id, {
            username,
            usernameReservedAt: now,
            usernameConfirmed: false,
            updatedAt: now
          })
        })
      } catch (txError) {
        // Transaction handled an error; rollback is automatic
        console.error('Username reservation transaction failed:', txError)
        if (txError instanceof Error && txError.message.includes('already taken')) {
          return {
            fieldErrors: { username: 'Username is already taken' }
          }
        }
        if (txError instanceof Error && txError.message.includes('temporarily reserved')) {
          return {
            fieldErrors: { username: 'Username is temporarily reserved. Try again in a few minutes.' }
          }
        }
        // Bubble up other errors to main catch
        throw txError
      }
    }

    // ---- Prepare full profile data update ----
    const updateData = {
      name: name.trim(),
      email: email.trim(),
      ...(username ? { 
        username,
        usernameConfirmed: true, // Mark username as confirmed
        usernameConfirmedAt: new Date()
      } : {}),
      bio: bio?.trim() || '',
      company: company?.trim() || '',
      position: position?.trim() || '',
      location: location?.trim() || '',
      website: website?.trim() || '',
      socialLinks: {
        linkedin: linkedin?.trim() || '',
        twitter: twitter?.trim() || '',
        github: github?.trim() || ''
      },
      updatedAt: new Date(),
    }

    // Actually persist update to user profile
    const result = await db().updateDoc('users', session.user.id, updateData)
    if (!result.success) {
      console.error('Profile update failed after username reservation:', result.error)
      // Username reservation will expire in 5 minutes if not confirmed below
      throw result.error || new Error('Failed to update profile')
    }
    
    // Confirm the username reservation is permanent
    if (username) {
      const usernameKey = username.toLowerCase()
      // Confirm reservation, mark as permanently owned after successful update
      const confirmResult = await db().updateDoc('usernames', usernameKey, {
        confirmed: true,
        confirmedAt: new Date(),
        expiresAt: null // No longer expiring
      })
      
      if (!confirmResult.success) {
        // Fails to confirm, but profile was updated anyway, so only log
        console.warn('Failed to confirm username reservation, but profile updated:', confirmResult.error)
        // TODO: Use native Next 16 cache tagging, signals, or mutation hooks if available for username reservation invalidation logic.
      }
    }
    
    // TODO: Switch to React 19/Next 16's new data revalidation primitives (cache hydration, revalidate tags/segments) once stable APIs are available.
    // Revalidate profile page path for current user to force reload of their new data.
    revalidatePath(`/[locale]/profile/${session.user.id}`)

    // wallet-history.ts is deprecated; we no longer record wallet history events here.
    // If username is set and user is verified, events should be queued by wagmi hooks, not via NativeTokenActivityService.
    // STUB: For future, queue username events using wagmi hooks instead of old NativeTokenActivityService
    // Steps:
    // 1. If username set and profile verified, call a hook/queue method in wagmi hook context.
    // 2. Remove all direct imports of NativeTokenActivityService.
    // 3. Ensure backwards compatibility for legacy event consumers (if any).

    return {
      success: true,
      message: 'Profile updated successfully!'
    }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return {
      error: 'Failed to update profile. Please try again.'
    }
  }
}

/**
 * Cleanup expired username reservations (should be called periodically via cron).
 * Releases (deletes) usernames that were reserved but not confirmed within the timeout window (default 5 minutes).
 * Returns number of reservations released.
 */
// TODO: For React19/Next16, consider a native CRON/action job if available once scheduler APIs land. Otherwise, continue to use external cron.
export async function cleanupExpiredUsernameReservations(): Promise<{
 cleaned: number }> {
  try {
    const now = new Date()

    // Query all expired AND unconfirmed usernames.
    const expiredResult = await db().queryDocs<{ id: string }>({
      collection: 'usernames',
      filters: [
        { field: 'confirmed', operator: '==', value: false },
        { field: 'expiresAt', operator: '<', value: now },
      ],
    })

    if (!expiredResult.success || !expiredResult.data?.length) {
      // Nothing to clean
      return { cleaned: 0 }
    }

    let cleaned = 0
    // Iterate and delete all expired reservations
    for (const reservation of expiredResult.data) {
      const deleteResult = await db().deleteDoc('usernames', reservation.id)
      if (deleteResult.success) {
        cleaned++
        console.log(`Cleaned expired username reservation: ${reservation.id}`)
      }
    }
    
    console.log(`Cleaned ${cleaned} expired username reservations`)
    return { cleaned }
    
  } catch (error) {
    console.error('Failed to cleanup expired username reservations:', error)
    return { cleaned: 0 }
  }
}

/**
 * Registers a new user with name, email, and password.
 * Currently a stub -- does NOT actually persist a real user.
 * 
 * @param prevState Previous state
 * @param formData Submitted registration form fields
 * @param locale User's language/locale
 */
export async function registerUser(
  prevState: UserFormState | null,
  formData: FormData,
  locale: Locale
): Promise<UserFormState> {

  // Extract the registration fields
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validate registration form fields
  const fieldErrors: Record<string, string> = {}

  if (!name?.trim()) {
    fieldErrors.name = 'Name is required'
  }

  if (!email?.trim()) {
    fieldErrors.email = 'Email is required'
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    fieldErrors.email = 'Please enter a valid email address'
  }

  if (!password) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters long'
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match'
  }

  if (Object.keys(fieldErrors).length > 0) {
    // Don't continue if any validation fails
    return { fieldErrors }
  }

  try {
    // STUB: Real user registration logic not yet implemented!
    // TODO: Step-by-step define registration flow:
    //   1. Check if email is already registered.
    //   2. Hash password securely (bcrypt/AWS Cognito/other).
    //   3. Create new user document/record.
    //   4. Send email verification (if necessary).
    //   5. Authenticate user or redirect.
    // Log registration attempt for debugging
    console.log('User registration data:', { name, email })

    // STUB: Simulate successful registration by redirecting to login page.
    redirect(ROUTES.LOGIN(locale) + '?message=Registration successful! Please log in.')
  } catch (error) {
    console.error('Error registering user:', error)
    return {
      error: 'Failed to register user. Please try again.'
    }
  }
}