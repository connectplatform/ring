'use server'

import { getServerAuthSession } from '@/auth'
import { UserSettings } from '@/features/auth/types'

export type UpdateSettingsResponse = {
  success: boolean;
  message: string;
  settings?: UserSettings;
}

export async function updateSettings(state: UpdateSettingsResponse | null, formData: FormData): Promise<UpdateSettingsResponse> {
  // Check authentication first
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return {
      success: false,
      message: 'You must be logged in to update settings'
    }
  }

  // Extract user ID from form data and validate authorization
  const requestedUserId = formData.get('userId') as string
  const currentUserId = session.user.id
  
  // Users can only update their own settings (unless they're admin)
  const isAdmin = session.user.role === 'admin'
  
  if (!isAdmin && requestedUserId !== currentUserId) {
    return {
      success: false,
      message: 'You can only update your own settings'
    }
  }

  // Use the session user ID for security (don't trust client data)
  const userId = isAdmin ? requestedUserId : currentUserId
  const data = Object.fromEntries(formData.entries()) as unknown as UserSettings

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/user-settings/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      // Add cache: 'no-store' to prevent caching
      cache: 'no-store',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error('Settings update failed:', errorData || response.statusText)
      throw new Error(errorData?.message || 'Failed to update settings')
    }
    
    const updatedSettings = await response.json()
    return {
      success: true,
      message: 'Settings updated successfully',
      settings: updatedSettings,
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update settings',
    }
  }
}

