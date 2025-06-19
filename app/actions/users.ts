'use server'

import { redirect } from 'next/navigation'
import { getServerAuthSession } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { getAdminDb } from '@/lib/firebase-admin.server'
import { defaultLocale } from '@/utils/i18n-server'

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
  const session = await getServerAuthSession()
  
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
    const adminDb = await getAdminDb()
    const userRef = adminDb.collection('users').doc(session.user.id)

    const updateData = {
      settings: {
        theme,
        language,
        notifications,
        emailUpdates
      },
      updatedAt: new Date(),
    }

    await userRef.set(updateData, { merge: true })

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
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to update profile'
    }
  }

  // Extract form data
  const name = formData.get('name') as string
  const email = formData.get('email') as string
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
    const adminDb = await getAdminDb()
    const userRef = adminDb.collection('users').doc(session.user.id)

    const updateData = {
      name: name.trim(),
      email: email.trim(),
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

    await userRef.set(updateData, { merge: true })

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