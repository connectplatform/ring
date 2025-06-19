'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { UserSettings } from '@/features/auth/types'
import { useSession } from 'next-auth/react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useActionState } from 'react'
import { Locale } from '@/utils/i18n-server'

/**
 * Response type for the updateSettings function
 */
type UpdateSettingsResponse = {
  success: boolean;
  message: string;
  settings?: UserSettings;
}

/**
 * SettingsContentProps interface
 * Defines the props for the SettingsContent component
 * 
 * @param initialSettings - The initial user settings
 * @param initialError - Any initial error message
 * @param searchParams - The search parameters from the URL
 * @param updateSettingsAction - The function to update user settings
 * @param locale - The current locale for i18n
 */
interface SettingsContentProps {
  initialSettings: UserSettings | null
  initialError: string | null
  searchParams: { [key: string]: string | string[] | undefined }
  updateSettingsAction: (prevState: UpdateSettingsResponse | null, formData: FormData) => Promise<UpdateSettingsResponse>
  locale: Locale
}

/**
 * SettingsContent Component
 * 
 * This component renders and manages user settings in the application.
 * It allows users to update their language preferences, notification settings, and theme.
 * 
 * User steps:
 * 1. User navigates to the settings page
 * 2. Component fetches current user settings
 * 3. User can modify settings using the provided form
 * 4. User submits the form to update their settings
 * 5. Feedback is provided to the user upon successful update or error
 * 
 * @param props - The SettingsContentProps
 * @returns {JSX.Element} The rendered SettingsContent component
 */
const SettingsContent: React.FC<SettingsContentProps> = ({ initialSettings, initialError, searchParams, updateSettingsAction, locale }) => {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { data: session, status } = useSession()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserSettings>()
  const [showAlert, setShowAlert] = useState(false)
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [error, setError] = useState<string | null>(initialError)

  // Use the useActionState hook for form submission
  const [state, formAction, isPending] = useActionState<UpdateSettingsResponse | null, FormData>(updateSettingsAction, null)

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  /**
   * Fetches user settings from the API
   */
  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user?.id) return
      setError(null)
      try {
        const response = await fetch(`/api/user-settings/${session.user.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch settings')
        }
        const fetchedSettings = await response.json()
        setSettings(fetchedSettings)
        reset(fetchedSettings)
      } catch (error) {
        console.error('Error fetching settings:', error)
        setError(t('errorFetchingSettings'))
      }
    }

    if (session) {
      fetchSettings()
    }
  }, [session, t, reset])

  // Render loading state
  if (status === 'loading' || isPending) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center items-center h-screen"
      >
        <motion.p
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-xl"
        >
          {t('loadingMessage')}
        </motion.p>
      </motion.div>
    )
  }

  // Render unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center items-center h-screen"
      >
        <motion.p className="text-xl text-destructive">
          {t('notAuthenticated')}
        </motion.p>
      </motion.div>
    )
  }

  // Render error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center items-center h-screen"
      >
        <motion.p className="text-xl text-destructive">
          {error}
        </motion.p>
      </motion.div>
    )
  }

  // Render no settings found state
  if (!settings) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center items-center h-screen"
      >
        <motion.p className="text-xl">
          {t('noSettingsFound')}
        </motion.p>
      </motion.div>
    )
  }

  /**
   * Handles theme change
   * @param value - The new theme value
   */
  const handleThemeChange = (value: string) => {
    setTheme(value)
  }

  // Render settings form
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-background text-foreground"
    >
      <div className="max-w-4xl mx-auto py-12 px-4">
        <motion.h1
          variants={itemVariants}
          className="text-4xl font-bold text-center mb-8"
        >
          {t('settings')}
        </motion.h1>
        <motion.div
          variants={itemVariants}
          className="max-w-md mx-auto"
        >
          <Card>
            <CardContent className="p-6">
              <form action={formAction} className="space-y-6">
                <input type="hidden" name="userId" value={session?.user?.id} />
                <motion.div variants={itemVariants}>
                  <Label htmlFor="language" className="block mb-2">{t('language')}</Label>
                  <Select defaultValue={settings.language} name="language">
                    <SelectTrigger id="language">
                      <SelectValue placeholder={t('selectLanguage')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="uk">Ukrainian</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
                <motion.div variants={itemVariants} className="flex items-center space-x-2">
                  <Switch
                    id="notifications"
                    defaultChecked={settings.notifications}
                    name="notifications"
                  />
                  <Label htmlFor="notifications">{t('enableNotifications')}</Label>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Label htmlFor="theme" className="block mb-2">{t('theme')}</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder={t('selectTheme')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('light')}</SelectItem>
                      <SelectItem value="dark">{t('dark')}</SelectItem>
                      <SelectItem value="system">{t('system')}</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending}
                  >
                    {isPending ? t('saving') : t('saveSettings')}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
        <AnimatePresence>
          {state && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.3 }}
              className="mt-4"
            >
              <Alert variant={state.success ? "default" : "destructive"}>
                <AlertTitle>{state.message}</AlertTitle>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default SettingsContent

