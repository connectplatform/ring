'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { UserSettings } from '@/features/auth/types'
import { useSearchParams } from 'next/navigation'
import type { Locale } from '@/i18n-config'

// Dynamically import the settings-content component
const SettingsContent = dynamic(() => import('@/features/auth/components/settings-content'), {
  loading: () => <LoadingFallback />,
  ssr: false
})

/**
 * LoadingFallback component
 * Displays a loading message while the content is being loaded
 * 
 * @returns {JSX.Element} The loading fallback UI
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">Loading settings...</div>
    </div>
  )
}

/**
 * Response type for the updateSettings function
 */
type UpdateSettingsResponse = {
  success: boolean;
  message: string;
  settings?: UserSettings;
}

/**
 * settings-wrapperProps interface
 * Defines the props for the settings-wrapper component
 * 
 * @param initialSettings - The initial user settings
 * @param initialError - Any initial error message
 * @param locale - The current locale for i18n
 */
interface SettingsWrapperProps {
  initialSettings: UserSettings | null
  initialError: string | null
  locale: Locale
}

/**
 * updateSettingsAction function
 * Client-side function to update user settings via API
 * 
 * @param prevState - The previous state of the settings update
 * @param formData - The form data containing the new settings
 * @returns A Promise that resolves to an UpdateSettingsResponse
 */
async function updateSettingsAction(prevState: UpdateSettingsResponse | null, formData: FormData): Promise<UpdateSettingsResponse> {
  const data = Object.fromEntries(formData.entries()) as unknown as UserSettings

  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update settings')
    }
    const result = await response.json()
    return {
      success: true,
      message: 'Settings updated successfully',
      settings: result.settings,
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    return {
      success: false,
      message: 'Failed to update settings',
    }
  }
}

/**
 * settings-wrapper component
 * Wraps the settings-content component and handles authentication state
 * Now with i18n support
 * 
 * User steps:
 * 1. User navigates to the settings page
 * 2. settings-wrapper checks authentication status
 * 3. If authenticated, settings-content is rendered with initial data and locale
 * 4. If not authenticated, an access denied message is displayed
 * 
 * @param props - The settings-wrapperProps
 * @returns {JSX.Element} The wrapped settings-content component or an error message
 */
export default function SettingsWrapper({ initialSettings, initialError, locale }: SettingsWrapperProps) {
  const { status } = useSession()
  const searchParams = useSearchParams()

  if (status === "loading") {
    return <LoadingFallback />
  }

  if (status === "unauthenticated") {
    return <div className="text-center py-8">Access Denied. Please sign in to view settings.</div>
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <SettingsContent 
        initialSettings={initialSettings}
        initialError={initialError}
        searchParams={Object.fromEntries(searchParams)}
        updateSettingsAction={updateSettingsAction}
        locale={locale}
      />
    </Suspense>
  )
}

