'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/routing'
import { useTranslations, useLocale } from 'next-intl'
import { useFormStatus } from 'react-dom'
import { useTheme } from 'next-themes'
import { setThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { UserSettings } from '@/features/auth/types'
import { useSession } from 'next-auth/react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { useActionState } from 'react'
import {
  Brain,
  Settings,
  Monitor,
  Sun,
  Moon,
  Languages,
  Lock,
  Bell,
  User,
  Shield,
  CheckCircle,
  Save,
  AlertCircle,
  X,
  Zap,
  Eye,
  EyeOff,
  Banknote,
} from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import {
  MAIN_CURRENCY,
  useOptionalStorePaymentMethods,
} from '@/features/store/currency-context'
import { getSupportedCurrencies } from '@/lib/ring-config-core'
import type { SupportedCurrencies } from '@/lib/ring-config-types'
import { updateDisplayCurrencyPreference } from '@/app/_actions/store-preferences-actions'
import { saveAiMatching, savePrivacyConsent } from '@/app/_actions/settings'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

const FIAT_DISPLAY_OPTIONS: SupportedCurrencies[] = getSupportedCurrencies()

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
 */
interface SettingsContentProps {
  initialSettings: UserSettings | null
  initialError: string | null
  searchParams: { [key: string]: string | string[] | undefined }
  updateSettingsAction: (prevState: UpdateSettingsResponse | null, formData: FormData) => Promise<UpdateSettingsResponse>
  locale: Locale
  activeTab?: string
  setActiveTab?: (tab: string) => void
  userStats?: {
    accountAge: string
    lastLogin: string
    createdAt?: string
    profileCompleteness: number
  }
}

/**
 * Submit Button Component using React 19 useFormStatus
 */
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
          Saving...
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}

/**
 * Settings Content Component
 * 
 * Contains all user settings - absorbed from both old settings-content
 * and the settings-related tabs from profile-content.
 * 
 * Tabs:
 * - Profile Settings (theme, language, profile stats)
 * - Communications (telegram, whatsapp, contact method, country, timezone)
 * - Professional (organization, position, bio, social links, skills)
 * - Privacy & Consent (data sharing, contact prefs)
 * - Notification Preferences (channels, frequency, AI matching, display)
 */
const SettingsContent: React.FC<SettingsContentProps> = ({ 
  initialSettings, 
  initialError, 
  searchParams, 
  updateSettingsAction, 
  locale,
  activeTab: externalActiveTab,
  setActiveTab: externalSetActiveTab,
  userStats,
}) => {
  const t = useTranslations('modules.settings')
  const tRail = useTranslations('modules.settings.rail')
  const tp = useTranslations('modules.profile')
  const localeHook = useLocale() as Locale
  const { theme, setTheme } = useTheme()
  const { data: session, status } = useSession()
  const router = useRouter()
  const storeCurrency = useOptionalStorePaymentMethods()
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrencies>(
    () => {
      const current = storeCurrency?.currency
      if (current && FIAT_DISPLAY_OPTIONS.includes(current as SupportedCurrencies)) {
        return current as SupportedCurrencies
      }
      return (MAIN_CURRENCY as SupportedCurrencies) || FIAT_DISPLAY_OPTIONS[0]
    },
  )

  const handleDisplayCurrencyChange = (code: SupportedCurrencies) => {
    setDisplayCurrency(code)
    storeCurrency?.setCurrency(code)
    if (status === 'authenticated') {
      updateDisplayCurrencyPreference(code).catch(() => {
        /* cookie/localStorage already updated via setCurrency */
      })
    }
  }

  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [error, setError] = useState<string | null>(initialError)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Fully controlled by external props from SettingsWrapper
  const activeTab = externalActiveTab ?? 'profile-settings'
  const setActiveTab = externalSetActiveTab ?? (() => {})

  // Use React 19 useActionState hook for form submission
  const [state, formAction, isPending] = useActionState<UpdateSettingsResponse | null, FormData>(
    updateSettingsAction, 
    null
  )

  // Settings tab menu items
  const settingsMenuItems = [
    { id: 'profile-settings', label: tRail('overview'), icon: Settings },
    { id: 'privacy', label: tRail('privacy'), icon: Lock },
    { id: 'preferences', label: tRail('notifications'), icon: Bell },
  ]

  // Form states for each section
  const [profileSettingsForm, setProfileSettingsForm] = useState({
    language: settings?.language || localeHook,
    theme: theme || 'system',
  })

  const [privacyForm, setPrivacyForm] = useState({
    analyticsConsent: (session?.user as any)?.privacy?.dataSharingConsent?.analytics || false,
    personalizationConsent: (session?.user as any)?.privacy?.dataSharingConsent?.personalization || false,
    anonymizedResearchConsent: (session?.user as any)?.privacy?.anonymizedResearchConsent || false,
    marketingCommunications: (session?.user as any)?.privacy?.contactPreferences?.marketing || false,
    opportunitiesNotifications: (session?.user as any)?.privacy?.contactPreferences?.opportunities || false
  })

  const [preferencesForm, setPreferencesForm] = useState({
    aiMatchingEnabled: settings?.aiMatching?.enabled ?? true,
    minMatchScore: String(settings?.aiMatching?.minMatchScore ?? 70),
    maxMatchesPerDay: String(settings?.aiMatching?.maxMatchesPerDay ?? 5),
    autoFillSuggestions: settings?.aiMatching?.autoFillSuggestions ?? true,
  })

  const reportSave = (ok: boolean, message: string) => {
    setSaveMessage(ok ? { type: 'success', message: t('saved') } : { type: 'error', message })
  }

  const persistPrivacy = async (next: typeof privacyForm) => {
    const previous = privacyForm
    setPrivacyForm(next)
    const result = await savePrivacyConsent({
      analytics: next.analyticsConsent,
      personalization: next.personalizationConsent,
      anonymizedResearch: next.anonymizedResearchConsent,
      marketing: next.marketingCommunications,
      opportunities: next.opportunitiesNotifications,
    })
    if (!result.success) {
      setPrivacyForm(previous)
      reportSave(false, result.message)
    }
  }

  const persistAiMatching = async (next: typeof preferencesForm) => {
    const previous = preferencesForm
    setPreferencesForm(next)
    const result = await saveAiMatching({
      enabled: next.aiMatchingEnabled,
      minMatchScore: Number(next.minMatchScore),
      maxMatchesPerDay: Number(next.maxMatchesPerDay),
      autoFillSuggestions: next.autoFillSuggestions,
    })
    if (!result.success) {
      setPreferencesForm(previous)
      reportSave(false, result.message)
    }
  }

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user?.id) return
      setError(null)
      try {
        const response = await fetch('/api/settings')
        if (!response.ok) throw new Error('Failed to fetch settings')
        const fetchedSettings = await response.json()
        setSettings(fetchedSettings)
      } catch (error) {
        console.error('Error fetching settings:', error)
        setError(t('errorFetchingSettings'))
      }
    }
    if (session) fetchSettings()
  }, [session, t])

  // Update local settings when action state changes
  useEffect(() => {
    if (state?.success && state.settings) {
      setSettings(state.settings)
      setError(null)
      setSaveMessage({ type: 'success', message: t('saved') })
    } else if (state && !state.success) {
      setError(state.message)
      setSaveMessage({ type: 'error', message: state.message })
    }
  }, [state, t])

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(localeHook, { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Language switching
  const switchLocale = (newLocale: string) => {
    localStorage.setItem('ring-locale', newLocale)
    document.cookie = `ring-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    router.push('/settings' as any, { locale: newLocale as any, scroll: false })
  }

  // Loading state — wait through Auth.js hydrate (SSR session should make this brief)
  if (status === 'loading' || isPending) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-pulse text-xl">{t('loadingMessage')}</div>
      </div>
    )
  }

  // Soft unauthenticated UI only — never auto-push LOGIN (Phase F).
  // TODO: Switch to useProtectedSession() once settings is always under (protected).
  if (status === 'unauthenticated') {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-xl text-destructive">{t('notAuthenticated')}</p>
      </div>
    )
  }

  // Error state
  if (error && !settings) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const renderProfileSettings = () => (
    <section className={cn(davinciGlassSurface, 'space-y-4 p-4')}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Settings className="h-5 w-5" />
          {t('userSettings')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('userSettingsDescription')}</p>
      </div>
        <div className="space-y-3">
          {/* Theme + Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">


          {/* Theme */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-muted">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span className="text-sm">{tp('theme')}</span>
            </div>
            <Select value={theme ?? 'system'} onValueChange={(v) => setThemeWithTransition(setTheme, v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-3 w-3" />
                    {tp('light')}
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-3 w-3" />
                    {tp('dark')}
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3 w-3" />
                    {tp('system')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-muted">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              <span className="text-sm">{tp('language')}</span>
            </div>
            <Select value={localeHook} onValueChange={(value) => switchLocale(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="uk">Українська</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Display currency (fiat presentment pool) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-muted sm:col-span-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              <span className="text-sm">{tp('displayCurrency')}</span>
            </div>
            <Select
              value={displayCurrency}
              onValueChange={(v) => handleDisplayCurrencyChange(v as SupportedCurrencies)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIAT_DISPLAY_OPTIONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          {/* Account Info Summary */}
          <div className={cn('rounded-xl p-4', davinciGlassSurface)}>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tp('memberSince')}</span>
                <span>{userStats?.createdAt ? formatDate(userStats.createdAt) : formatDate((session?.user as any)?.createdAt || null)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t('accountAge')}</span>
                <span>{userStats?.accountAge || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tp('lastLogin')}</span>
                <span>{userStats?.lastLogin || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tp('email')}</span>
                <span className="truncate ml-2">{session?.user?.email}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{tp('role')}</span>
                <Badge variant="secondary">{session?.user?.role}</Badge>
              </div>
            </div>
          </div>
        </div>
    </section>
  )

  const renderPrivacy = () => (
    <section className={cn(davinciGlassSurface, 'space-y-6 p-4')}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lock className="h-5 w-5" />
          {tp('privacy')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{tp('privacyDescription')}</p>
      </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{tp('dataSharingConsent')}</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('analyticsAndPerformance')}</Label>
              <p className="text-sm text-muted-foreground">{tp('helpImproveRingPlatform')}</p>
            </div>
            <Switch
              checked={privacyForm.analyticsConsent}
              onCheckedChange={(checked) => {
                void persistPrivacy({ ...privacyForm, analyticsConsent: checked })
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('personalization')}</Label>
              <p className="text-sm text-muted-foreground">{tp('personalizedContentAndRecommendations')}</p>
            </div>
            <Switch
              checked={privacyForm.personalizationConsent}
              onCheckedChange={(checked) => {
                void persistPrivacy({ ...privacyForm, personalizationConsent: checked })
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('anonymizedResearch')}</Label>
              <p className="text-sm text-muted-foreground">{tp('helpImproveAIFeatures')}</p>
            </div>
            <Switch
              checked={privacyForm.anonymizedResearchConsent}
              onCheckedChange={(checked) => {
                void persistPrivacy({ ...privacyForm, anonymizedResearchConsent: checked })
              }}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{tp('contactPreferences')}</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('marketingCommunications')}</Label>
              <p className="text-sm text-muted-foreground">{tp('updatesAboutNewFeaturesAndOffers')}</p>
            </div>
            <Switch
              checked={privacyForm.marketingCommunications}
              onCheckedChange={(checked) => {
                void persistPrivacy({ ...privacyForm, marketingCommunications: checked })
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('opportunities')}</Label>
              <p className="text-sm text-muted-foreground">{tp('jobAndCollaborationOpportunities')}</p>
            </div>
            <Switch
              checked={privacyForm.opportunitiesNotifications}
              onCheckedChange={(checked) => {
                void persistPrivacy({ ...privacyForm, opportunitiesNotifications: checked })
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{tp('systemNotifications')}</Label>
              <p className="text-sm text-muted-foreground">{tp('securityAndAccountUpdatesRequired')}</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
        </div>
    </section>
  )

  const renderPreferences = () => (
    <div className="space-y-6">
      <section className={cn(davinciGlassSurface, 'space-y-6 p-4')}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bell className="h-5 w-5" />
          {tp('preferences')}
        </h2>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{t('notificationPreferencesTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('notificationPreferencesDescription')}</p>
            <Button variant="outline" asChild>
              <Link href={ROUTES.NOTIFICATIONS_SETTINGS(locale)}>
                {t('notificationPreferencesTitle')}
              </Link>
            </Button>
          </div>

          <Separator />

          {/* AI Matching */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {t('aiMatching.title')}
            </h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{tp('getAIPoweredOpportunityRecommendations')}</Label>
              </div>
              <Switch
                checked={preferencesForm.aiMatchingEnabled}
                onCheckedChange={(checked) => {
                  void persistAiMatching({ ...preferencesForm, aiMatchingEnabled: checked })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiMatching.minMatchScore')}</Label>
              <Select 
                value={preferencesForm.minMatchScore} 
                onValueChange={(value) => {
                  void persistAiMatching({ ...preferencesForm, minMatchScore: value })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">{tp('showAllRelevant')}</SelectItem>
                  <SelectItem value="70">{tp('goodMatches')}</SelectItem>
                  <SelectItem value="85">{tp('greatMatchesOnly')}</SelectItem>
                  <SelectItem value="95">{tp('perfectMatches')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('aiMatching.maxMatchesPerDay')}</Label>
              <Select 
                value={preferencesForm.maxMatchesPerDay} 
                onValueChange={(value) => {
                  void persistAiMatching({ ...preferencesForm, maxMatchesPerDay: value })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 - {t('aiMatching.limitLabels.conservative')}</SelectItem>
                  <SelectItem value="5">5 - {t('aiMatching.limitLabels.moderate')}</SelectItem>
                  <SelectItem value="10">10 - {t('aiMatching.limitLabels.aggressive')}</SelectItem>
                  <SelectItem value="0">{t('aiMatching.limitLabels.unlimited')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{tp('autoFillSuggestions')}</Label>
              <Switch
                checked={preferencesForm.autoFillSuggestions}
                onCheckedChange={(checked) => {
                  void persistAiMatching({ ...preferencesForm, autoFillSuggestions: checked })
                }}
              />
            </div>
          </div>
      </section>
    </div>
  )

  // Render the settings form
  return (
    <div className="min-h-full">
      {/* Success/Error Message */}
      {saveMessage && (
        <div className="mb-4">
          <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'}>
            <div className="flex items-center justify-between">
              <span>{saveMessage.message}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveMessage(null)}
                className="ml-2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Mobile Section Title */}
      <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {React.createElement(
              settingsMenuItems.find(item => item.id === activeTab)?.icon || Settings,
              { className: "w-6 h-6" }
            )}
            {settingsMenuItems.find(item => item.id === activeTab)?.label}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {activeTab === 'profile-settings' && t('userSettingsDescription')}
          {activeTab === 'privacy' && tp('privacyDescription')}
          {activeTab === 'preferences' && t('settingsDescription')}
        </p>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'profile-settings' && renderProfileSettings()}
        {activeTab === 'privacy' && renderPrivacy()}
        {activeTab === 'preferences' && renderPreferences()}
      </div>
    </div>
  )
}

export default SettingsContent
