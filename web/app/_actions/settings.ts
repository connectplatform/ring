'use server'

import { auth } from '@/auth'
import { PrivacyConsent, UserSettings } from '@/features/auth/types'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { PrivacyConsentService } from '@/features/auth/services/privacy-consent-service'

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
  const isAdmin = isPlatformAdmin(session.user.role)
  
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

export async function saveAiMatching(patch: {
  enabled: boolean
  minMatchScore: number
  maxMatchesPerDay: number
  autoFillSuggestions: boolean
}): Promise<UpdateSettingsResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, message: 'You must be logged in to update settings' }
  }

  const { getUserSettings } = await import('@/features/auth/services/get-user-settings')
  const { updateUserSettings } = await import('@/features/auth/services/update-user-settings')
  const current = await getUserSettings()
  const success = await updateUserSettings({
    ...(current ?? {
      language: 'en',
      theme: 'system',
      notifications: true,
      notificationPreferences: { email: true, inApp: true, sms: false },
    }),
    aiMatching: {
      enabled: patch.enabled,
      minMatchScore: patch.minMatchScore,
      maxMatchesPerDay: patch.maxMatchesPerDay,
      preferredCategories: current?.aiMatching?.preferredCategories ?? [],
      preferredWorkTypes: current?.aiMatching?.preferredWorkTypes ?? [],
      autoFillSuggestions: patch.autoFillSuggestions,
    },
  })

  return success
    ? { success: true, message: 'Settings updated successfully' }
    : { success: false, message: 'Failed to update settings' }
}

export async function savePrivacyConsent(patch: {
  analytics: boolean
  personalization: boolean
  anonymizedResearch: boolean
  marketing: boolean
  opportunities: boolean
}): Promise<UpdateSettingsResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, message: 'You must be logged in to update settings' }
  }

  try {
    const service = PrivacyConsentService.getInstance()
    const existing = await service.getUserConsent(session.user.id)
    const consent: PrivacyConsent = {
      dataSharingConsent: {
        analytics: patch.analytics,
        personalization: patch.personalization,
        notifications: existing?.dataSharingConsent.notifications ?? true,
        research: existing?.dataSharingConsent.research ?? false,
      },
      anonymizedResearchConsent: patch.anonymizedResearch,
      contactPreferences: {
        marketing: patch.marketing,
        opportunities: patch.opportunities,
        system: true,
        evolution: existing?.contactPreferences.evolution ?? true,
      },
    }
    await service.updateUserConsent(session.user.id, consent)
    return { success: true, message: 'Settings updated successfully' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update settings',
    }
  }
}

