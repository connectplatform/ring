'use server'

import { auth } from '@/auth'
import { UserSettings } from '@/features/auth/types'

export type UpdateSettingsResponse = {
  success: boolean;
  message: string;
  settings?: UserSettings;
}

export async function updateSettings(state: UpdateSettingsResponse | null, formData: FormData): Promise<UpdateSettingsResponse> {
  // Check authentication first
  const session = await auth()
  
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
    // Call the service directly instead of making HTTP request
    const { updateUserSettings } = await import('@/features/auth/services/update-user-settings');
    
    const success = await updateUserSettings(data);
    
    if (!success) {
      console.error('Settings update failed');
      throw new Error('Failed to update settings');
    }
    
    return {
      success: true,
      message: 'Settings updated successfully',
      settings: data, // Return the updated data
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update settings',
    }
  }
}

