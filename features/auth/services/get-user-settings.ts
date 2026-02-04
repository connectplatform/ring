/**
 * Get User Settings Service
 * 
 * Retrieves user settings from PostgreSQL database
 * Uses React 19 cache() for request deduplication
 */

import { UserSettings } from '@/features/auth/types'
import { cache } from 'react'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

/**
 * Retrieve user settings from PostgreSQL database
 * 
 * @returns UserSettings object or null if not found
 */
export async function getUserSettings(): Promise<UserSettings | null> {
  console.log('getUserSettings: Starting')

  try {
    // Authenticate
    const session = await auth()
    if (!session || !session.user?.id) {
      console.error('getUserSettings: No session')
      throw new Error('Unauthorized')
    }

    const userId = session.user.id
    console.log('getUserSettings: Fetching for user', userId)

    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()

    // Read user document
    const result = await db.findById('users', userId)

    if (!result.success || !result.data) {
      console.log('getUserSettings: User document not found')
      // Return default settings
      return {
        language: 'en',
        theme: 'system',
        notifications: true,
        notificationPreferences: {
          email: true,
          inApp: true,
          sms: false,
        },
      }
    }

    const userData = result.data as any
    const userSettings: UserSettings = userData.data?.settings || {
      language: 'en',
      theme: 'system',
      notifications: true,
      notificationPreferences: {
        email: true,
        inApp: true,
        sms: false,
      },
    }

    console.log('getUserSettings: Success')
    return userSettings

  } catch (error) {
    console.error('getUserSettings: Error:', error)
    return null
  }
}

