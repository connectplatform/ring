'use client'

import React from 'react'
import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { motion } from 'framer-motion'
import { Save, Check, Settings } from 'lucide-react'
import { updateUserSettings, UserFormState } from '@/app/_actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

interface UserSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
  language: string
  theme: string
  timezone: string
  visibility: string
  pendingChanges?: boolean
}

interface UserSettingsFormProps {
  initialSettings: UserSettings
  className?: string
}

function SubmitButton({ hasChanges }: { hasChanges: boolean }) {
  const { pending } = useFormStatus()
  const t = useTranslations('settings')
  
  return (
    <Button 
      type="submit" 
      disabled={pending || !hasChanges}
      className="w-full"
    >
      {pending ? (
        <>
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
          />
          {t('saving') || 'Saving...'}
        </>
      ) : hasChanges ? (
        <>
          <Save className="mr-2 h-4 w-4" />
          {t('saveSettings') || 'Save Settings'}
        </>
      ) : (
        <>
          <Check className="mr-2 h-4 w-4" />
          {t('saved') || 'Saved'}
        </>
      )}
    </Button>
  )
}

export default function UserSettingsOptimistic({ initialSettings, className }: UserSettingsFormProps) {
  const t = useTranslations('settings')
  const { data: session } = useSession()

  // Optimistic updates for instant settings feedback
  const [optimisticSettings, updateOptimisticSettings] = useOptimistic(
    initialSettings,
    (currentSettings: UserSettings, newSettings: Partial<UserSettings>) => ({
      ...currentSettings,
      ...newSettings,
      pendingChanges: true
    })
  )

  const [state, formAction] = useActionState<UserFormState | null, FormData>(
    updateUserSettings,
    null
  )

  const handleFieldChange = (field: keyof UserSettings, value: any) => {
    updateOptimisticSettings({ [field]: value })
  }

  const hasChanges = JSON.stringify(optimisticSettings) !== JSON.stringify(initialSettings)

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('userSettings') || 'User Settings'}
          </CardTitle>
          <CardDescription>
            {t('settingsDescription') || 'Manage your account preferences and privacy settings'}
          </CardDescription>
          {optimisticSettings.pendingChanges && (
            <Badge variant="outline" className="w-fit">
              {t('unsavedChanges') || 'Unsaved changes'}
            </Badge>
          )}
        </CardHeader>

        <CardContent>
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
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <Check className="h-4 w-4" />
                  <AlertTitle>Settings Updated</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Notification Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('notifications') || 'Notifications'}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifications" className="text-sm font-medium">
                    {t('emailNotifications') || 'Email Notifications'}
                  </Label>
                  <Switch
                    id="emailNotifications"
                    name="emailNotifications"
                    checked={optimisticSettings.emailNotifications}
                    onCheckedChange={(checked) => handleFieldChange('emailNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="pushNotifications" className="text-sm font-medium">
                    {t('pushNotifications') || 'Push Notifications'}
                  </Label>
                  <Switch
                    id="pushNotifications"
                    name="pushNotifications"
                    checked={optimisticSettings.pushNotifications}
                    onCheckedChange={(checked) => handleFieldChange('pushNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="marketingEmails" className="text-sm font-medium">
                    {t('marketingEmails') || 'Marketing Emails'}
                  </Label>
                  <Switch
                    id="marketingEmails"
                    name="marketingEmails"
                    checked={optimisticSettings.marketingEmails}
                    onCheckedChange={(checked) => handleFieldChange('marketingEmails', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Appearance Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('appearance') || 'Appearance'}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language">{t('language') || 'Language'}</Label>
                  <Select
                    name="language"
                    value={optimisticSettings.language}
                    onValueChange={(value) => handleFieldChange('language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">{t('theme') || 'Theme'}</Label>
                  <Select
                    name="theme"
                    value={optimisticSettings.theme}
                    onValueChange={(value) => handleFieldChange('theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('privacy') || 'Privacy'}</h3>
              
              <div className="space-y-2">
                <Label htmlFor="visibility">{t('profileVisibility') || 'Profile Visibility'}</Label>
                <Select
                  name="visibility"
                  value={optimisticSettings.visibility}
                  onValueChange={(value) => handleFieldChange('visibility', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="members">Members Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">{t('timezone') || 'Timezone'}</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  value={optimisticSettings.timezone}
                  onChange={(e) => handleFieldChange('timezone', e.target.value)}
                  placeholder="UTC"
                />
              </div>
            </div>

            {/* Hidden fields for form submission */}
            <input type="hidden" name="emailNotifications" value={optimisticSettings.emailNotifications.toString()} />
            <input type="hidden" name="pushNotifications" value={optimisticSettings.pushNotifications.toString()} />
            <input type="hidden" name="marketingEmails" value={optimisticSettings.marketingEmails.toString()} />

            <SubmitButton hasChanges={hasChanges} />
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 