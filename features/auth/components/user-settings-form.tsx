'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateUserSettings, UserFormState } from '@/app/_actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('modules.settings')
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full"
    >
      {pending ? t('saving') || 'Saving...' : t('saveSettings') || 'Save Settings'}
    </Button>
  )
}

function UserSettingsFormContent() {
  const t = useTranslations('modules.settings')
  const { data: session } = useSession()
  const [state, formAction] = useActionState<UserFormState | null, FormData>(
    updateUserSettings,
    null
  )

  if (!session?.user) {
    return (
      <Alert>
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please log in to access your settings.</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Show error message if any */}
      {state?.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Show success message if any */}
      {state?.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {/* Theme Selection */}
      <div className="space-y-2">
        <Label htmlFor="theme">{t('theme') || 'Theme'}</Label>
        <Select name="theme" defaultValue="system">
          <SelectTrigger>
            <SelectValue placeholder={t('selectTheme') || 'Select theme'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">{t('light') || 'Light'}</SelectItem>
            <SelectItem value="dark">{t('dark') || 'Dark'}</SelectItem>
            <SelectItem value="system">{t('system') || 'System'}</SelectItem>
          </SelectContent>
        </Select>
        {state?.fieldErrors?.theme && (
          <p className="text-sm text-destructive">{state.fieldErrors.theme}</p>
        )}
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <Label htmlFor="language">{t('language') || 'Language'}</Label>
        <Select name="language" defaultValue="en">
          <SelectTrigger>
            <SelectValue placeholder={t('selectLanguage') || 'Select language'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="uk">Українська</SelectItem>
          </SelectContent>
        </Select>
        {state?.fieldErrors?.language && (
          <p className="text-sm text-destructive">{state.fieldErrors.language}</p>
        )}
      </div>

      {/* Notification Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">{t('notifications') || 'Notifications'}</Label>
            <p className="text-sm text-muted-foreground">
              {t('notificationsDescription') || 'Receive push notifications for important updates'}
            </p>
          </div>
          <Switch 
            id="notifications" 
            name="notifications"
            defaultChecked={true}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailUpdates">{t('emailUpdates') || 'Email Updates'}</Label>
            <p className="text-sm text-muted-foreground">
              {t('emailUpdatesDescription') || 'Receive email notifications about new opportunities'}
            </p>
          </div>
          <Switch 
            id="emailUpdates" 
            name="emailUpdates"
            defaultChecked={false}
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

/**
 * UserSettingsForm component
 * Modern React 19 implementation with Server Actions
 * 
 * Features:
 * - useActionState() for form state management
 * - useFormStatus() for automatic loading states
 * - Server-side validation with field-specific errors
 * - Progressive enhancement (works without JavaScript)
 * - Real-time settings updates
 * 
 * @returns JSX.Element
 */
export default function UserSettingsForm() {
  const t = useTranslations('modules.settings')
  const { data: session, status } = useSession()
  const router = useRouter()

  // Handle unauthenticated users
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(ROUTES.LOGIN(DEFAULT_LOCALE))
    }
  }, [status, router])

  if (status === 'loading') {
    return <div className="text-center py-8">{t('loading') || 'Loading...'}</div>
  }

  if (status === 'unauthenticated') {
    return <div className="text-center py-8">{t('redirecting') || 'Redirecting...'}</div>
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('userSettings') || 'User Settings'}</CardTitle>
        <CardDescription>
          {t('userSettingsDescription') || 'Manage your account preferences and notification settings'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UserSettingsFormContent />
      </CardContent>
    </Card>
  )
} 