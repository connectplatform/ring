'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'
import { defaultLocale } from '@/i18n-config'
import { revalidatePath } from 'next/cache'

export interface UserFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

export async function updateUserSettings(
  prevState: UserFormState | null,
  formData: FormData
): Promise<UserFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update settings'
    }
  }

  // Extract form data
  const theme = formData.get('theme') as string
  const language = formData.get('language') as string
  const notifications = formData.get('notifications') === 'on'
  const emailUpdates = formData.get('emailUpdates') === 'on'

  // Validation
  if (theme && !['light', 'dark', 'system'].includes(theme)) {
    return {
      fieldErrors: { theme: 'Invalid theme setting' }
    }
  }

  if (language && !['en', 'uk'].includes(language)) {
    return {
      fieldErrors: { language: 'Invalid language setting' }
    }
  }

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    const updateData = {
      settings: {
        theme,
        language,
        notifications,
        emailUpdates
      },
      updatedAt: new Date(),
    }

    const result = await db.update('users', session.user.id, updateData)
    if (!result.success) {
      throw result.error || new Error('Failed to update settings')
    }
    
    // Revalidate user profile (React 19 pattern)
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

export async function updateUserProfile(
  prevState: UserFormState | null,
  formData: FormData
): Promise<UserFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update profile'
    }
  }

  // Extract form data
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

  // Validation
  const fieldErrors: Record<string, string> = {}

  // Username validation: optional but unique, alphanumeric+underscore/hyphen, 3-32 chars
  if (username) {
    if (!/^[a-zA-Z0-9_\-]{3,32}$/.test(username)) {
      fieldErrors.username = 'Username must be 3-32 characters and contain only letters, numbers, underscores, or hyphens'
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

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    await initializeDatabase()
    const db = getDatabaseService()

    // If username provided, ensure uniqueness via transaction with rollback protection
    if (username) {
      const usernameKey = username.toLowerCase()
      const RESERVATION_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
      const now = new Date()
      const expiryTime = new Date(now.getTime() + RESERVATION_EXPIRY_MS)
      
      try {
        await db.transaction(async (txn) => {
          // Check if username is taken by another user
          const usernameDoc = await txn.read('usernames', usernameKey)
          const userDoc = await txn.read('users', session.user.id)
          
          const currentUsername = userDoc ? (userDoc as any).username?.toLowerCase() : undefined
          
          // Check if username exists and belongs to someone else
          if (usernameDoc) {
            const reservationData = usernameDoc as any
            const owner = reservationData.userId
            const reservedAt = reservationData.reservedAt ? new Date(reservationData.reservedAt) : null
            const confirmed = reservationData.confirmed || false
            
            // If owned by another user and either confirmed OR still within expiry window
            if (owner !== session.user.id) {
              if (confirmed) {
                throw new Error('Username is already taken')
              }
              
              // Check if reservation expired (5 minutes)
              if (reservedAt && (now.getTime() - reservedAt.getTime()) < RESERVATION_EXPIRY_MS) {
                throw new Error('Username is temporarily reserved by another user')
              }
              
              // Expired reservation - we can claim it
              console.log(`Username ${usernameKey} reservation expired, releasing for new user`)
            }
          }
          
          // Free old username mapping if user is changing username
          if (currentUsername && currentUsername !== usernameKey) {
            await txn.delete('usernames', currentUsername)
          }
          
          // Reserve new username with expiration and confirmation tracking
          await txn.create('usernames', {
            userId: session.user.id,
            username: username, // Store original case
            reservedAt: now,
            confirmedAt: null, // Will be set when profile update succeeds
            confirmed: false, // Will be set to true on success
            expiresAt: expiryTime,
            updatedAt: now
          }, { id: usernameKey })
          
          // Update user with username (temp reservation)
          await txn.update('users', session.user.id, {
            username,
            usernameReservedAt: now,
            usernameConfirmed: false,
            updatedAt: now
          })
        })
      } catch (txError) {
        // Transaction error - rollback is automatic, username NOT reserved
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
        throw txError // Re-throw other transaction errors
      }
    }

    // Update full profile data
    const updateData = {
      name: name.trim(),
      email: email.trim(),
      ...(username ? { 
        username,
        usernameConfirmed: true, // Confirm username after successful update
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

    const result = await db.update('users', session.user.id, updateData)
    if (!result.success) {
      // Profile update failed - username reservation will expire in 5 minutes
      console.error('Profile update failed after username reservation:', result.error)
      throw result.error || new Error('Failed to update profile')
    }
    
    // Confirm username reservation permanently (only if profile update succeeded!)
    if (username) {
      const usernameKey = username.toLowerCase()
      const confirmResult = await db.update('usernames', usernameKey, {
        confirmed: true,
        confirmedAt: new Date(),
        expiresAt: null // Remove expiration - username now permanently owned
      })
      
      if (!confirmResult.success) {
        console.warn('Failed to confirm username reservation, but profile updated:', confirmResult.error)
        // Don't fail the whole operation - username will expire but user profile is updated
      }
    }
    
    // Revalidate user profile (React 19 pattern)
    revalidatePath(`/[locale]/profile/${session.user.id}`)

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
 * Cleanup expired username reservations (should be called periodically via cron)
 * Releases usernames that were reserved but never confirmed within 5 minutes
 */
export async function cleanupExpiredUsernameReservations(): Promise<{
 cleaned: number }> {
  try {
    await initializeDatabase()
    const db = getDatabaseService()
    
    const now = new Date()
    
    // Query unconfirmed reservations that have expired
    const expiredResult = await db.query({
      collection: 'usernames',
      filters: [
        { field: 'confirmed', operator: '==', value: false },
        { field: 'expiresAt', operator: '<', value: now }
      ]
    })
    
    if (!expiredResult.success || expiredResult.data.length === 0) {
      return { cleaned: 0 }
    }
    
    // Delete expired reservations
    let cleaned = 0
    for (const reservation of expiredResult.data) {
      const deleteResult = await db.delete('usernames', reservation.id)
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

export async function registerUser(
  prevState: UserFormState | null,
  formData: FormData
): Promise<UserFormState> {

  // Extract form data
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

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

  if (!password) {
    fieldErrors.password = 'Password is required'
  } else if (password.length < 6) {
    fieldErrors.password = 'Password must be at least 6 characters long'
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  try {
    // For now, just simulate the registration
    // In a real implementation, you'd create the user account here
    console.log('User registration data:', { name, email })

    // Simulate success and redirect to login
    redirect(ROUTES.LOGIN(defaultLocale) + '?message=Registration successful! Please log in.')
  } catch (error) {
    console.error('Error registering user:', error)
    return {
      error: 'Failed to register user. Please try again.'
    }
  }
} 