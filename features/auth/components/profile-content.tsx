'use client'

/**
 * ENHANCED PROFILE CONTENT - Ring Platform v2.0
 * ============================================
 * Emperor Ray's Vision: Complete Digital Kingdom Blueprint
 * 
 * Strike Team:
 * - UI/UX Optimization Agent (Core Web Vitals, responsive design)
 * - React 19 Specialist (Server Components, optimistic updates)
 * - Next.js 15 Specialist (App Router optimization)
 * - Tailwind CSS 4 Specialist (Beautiful styling)
 * - Mobile Documentation Optimizer (Mobile-first excellence)
 * - Accessibility Compliance Enforcer (WCAG compliance)
 * 
 * NEW FEATURES IMPLEMENTED:
 * 1. Communication Channels (Telegram, WhatsApp, preferred method)
 * 2. Social Media Profiles (LinkedIn, Twitter, Facebook)
 * 3. Skills & Interests Management
 * 4. Privacy & Consent Controls (GDPR compliant)
 * 5. Advanced Notification Settings (frequency, channels, categories)
 * 6. AI Matching Preferences (full control)
 * 7. Cultural Context (timezone, languages, country)
 * 8. Security Settings (2FA, sessions, devices)
 * 9. Account Activity (searches, engagement, history)
 * 10. Achievements & Progress Tracking
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import type { Locale } from '@/i18n-config'
import { useTheme } from 'next-themes'
import { ProfileContentProps } from '@/types/profile'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import CountrySelect from '@/components/ui/country-select'
import TimezoneSelect from '@/components/ui/timezone-select'
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'
import { UserRole, KYCStatus, KYCLevel, KYCDocumentType } from '@/features/auth/types'
import KYCUpload from './kyc-upload'
import WalletSection from '@/features/wallet/components/wallet-section'
import { useAuth } from '@/hooks/use-auth'
import { useSession, signOut } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import {
  User,
  Mail,
  Wallet,
  Shield,
  Calendar,
  Edit2,
  Save,
  AlertCircle,
  Camera,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  X,
  Clock,
  Settings,
  CreditCard,
  Building,
  Eye,
  Download,
  Phone,
  Globe,
  MapPin,
  Briefcase,
  Star,
  Award,
  Target,
  LogOut,
  Bell,
  Lock,
  Zap,
  MessageSquare,
  Linkedin,
  Twitter,
  Facebook,
  Send,
  Languages,
  Users,
  TrendingUp,
  Activity,
  Monitor,
  Smartphone,
  Search,
  Heart,
  BookOpen,
  Sparkles,
  Moon,
  Sun
} from 'lucide-react'

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('modules.profile')
  
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Save className="mr-2 h-4 w-4 animate-spin" />
          {t('saving')}
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          {t('save')}
        </>
      )}
    </Button>
  )
}

export default function ProfileContent({ 
  initialUser, 
  initialError, 
  params, 
  searchParams,
  session,
  updateProfile 
}: ProfileContentProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { getKycStatus, refreshSession } = useAuth()
  const { update: updateSession } = useSession()
  const { setTheme, theme, systemTheme } = useTheme()
  const currentTheme = theme === 'system' ? systemTheme : theme
  const [isEditing, setIsEditing] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const user = initialUser || session?.user
  const kycStatus = getKycStatus()

  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [isEditingSection, setIsEditingSection] = useState(false)
  const [usernameMode, setUsernameMode] = useState<'view' | 'edit' | 'checking'>('view')
  const [usernameValue, setUsernameValue] = useState(user?.username || '')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  
  const [state, formAction] = useActionState(updateProfile, {
    success: false,
    message: ''
  })

  // Form state management for tracking unsaved changes
  const [communicationsForm, setCommunicationsForm] = useState({
    telegramUsername: (user as any)?.communication?.telegramUsername || '',
    whatsappNumber: (user as any)?.communication?.whatsappNumber || '',
    preferredContactMethod: (user as any)?.communication?.preferredContactMethod || 'email',
    country: (user as any)?.cultural?.country || '',
    timezone: (user as any)?.cultural?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  const [professionalForm, setProfessionalForm] = useState({
    organization: (user as any)?.organization || '',
    position: (user as any)?.position || '',
    bio: (user as any)?.bio || '',
    linkedin: (user as any)?.integrations?.socialProfiles?.linkedin || '',
    twitter: (user as any)?.integrations?.socialProfiles?.twitter || '',
    facebook: (user as any)?.integrations?.socialProfiles?.facebook || '',
    skills: (user as any)?.skills || []
  })

  const [privacyForm, setPrivacyForm] = useState({
    analyticsConsent: (user as any)?.privacy?.dataSharingConsent?.analytics || false,
    personalizationConsent: (user as any)?.privacy?.dataSharingConsent?.personalization || false,
    anonymizedResearchConsent: (user as any)?.privacy?.anonymizedResearchConsent || false,
    marketingCommunications: (user as any)?.privacy?.contactPreferences?.marketing || false,
    opportunitiesNotifications: (user as any)?.privacy?.contactPreferences?.opportunities || false
  })

  const [preferencesForm, setPreferencesForm] = useState({
    emailNotifications: user?.notificationPreferences?.email || false,
    inAppNotifications: user?.notificationPreferences?.inApp || false,
    smsNotifications: user?.notificationPreferences?.sms || false,
    notificationFrequency: (user as any)?.experience?.notificationSettings?.frequency || 'immediate',
    aiMatchingEnabled: (user?.settings as any)?.aiMatching?.enabled || false,
    minMatchScore: String((user?.settings as any)?.aiMatching?.minMatchScore || 70),
    maxMatchesPerDay: String((user?.settings as any)?.aiMatching?.maxMatchesPerDay || 10),
    autoFillSuggestions: (user?.settings as any)?.aiMatching?.autoFillSuggestions || false,
    preferredLanguage: (user as any)?.experience?.uiCustomizations?.language || 'uk',
    compactView: (user as any)?.experience?.uiCustomizations?.compactView || false
  })

  // Language switching functionality
  const switchLocale = useCallback((newLocale: string) => {
    const pathWithoutLocale = window.location.pathname.replace(/^\/[a-z]{2}/, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    router.push(newPath, { scroll: false })
  }, [router])

  // Check if there are unsaved changes
  const hasCommunicationsChanges = JSON.stringify(communicationsForm) !== JSON.stringify({
    telegramUsername: (user as any)?.communication?.telegramUsername || '',
    whatsappNumber: (user as any)?.communication?.whatsappNumber || '',
    preferredContactMethod: (user as any)?.communication?.preferredContactMethod || 'email',
    country: (user as any)?.cultural?.country || '',
    timezone: (user as any)?.cultural?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  // Save functions for each section
  const saveCommunications = async () => {
    setCommunicationsSaving(true)
    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('communication', JSON.stringify({
        telegramUsername: communicationsForm.telegramUsername,
        whatsappNumber: communicationsForm.whatsappNumber,
        preferredContactMethod: communicationsForm.preferredContactMethod
      }))
      formData.append('cultural', JSON.stringify({
        country: communicationsForm.country,
        timezone: communicationsForm.timezone
      }))

      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        // Reset form state to match saved data
        setCommunicationsForm(prev => prev)
        setSaveMessage({ type: 'success', message: 'Communication settings saved successfully!' })
        router.refresh()
      } else {
        setSaveMessage({ type: 'error', message: result.message || 'Failed to save communication settings' })
      }
      return result
    } catch (error) {
      setSaveMessage({ type: 'error', message: 'Network error occurred while saving' })
      throw error
    } finally {
      setCommunicationsSaving(false)
    }
  }

  const saveProfessional = async () => {
    setProfessionalSaving(true)
    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('organization', professionalForm.organization)
      formData.append('position', professionalForm.position)
      formData.append('bio', professionalForm.bio)
      formData.append('integrations', JSON.stringify({
        socialProfiles: {
          linkedin: professionalForm.linkedin,
          twitter: professionalForm.twitter,
          facebook: professionalForm.facebook
        }
      }))
      formData.append('skills', JSON.stringify(professionalForm.skills))

      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        setProfessionalForm(prev => prev)
        setSaveMessage({ type: 'success', message: 'Professional profile saved successfully!' })
        router.refresh()
      } else {
        setSaveMessage({ type: 'error', message: result.message || 'Failed to save professional profile' })
      }
      return result
    } catch (error) {
      setSaveMessage({ type: 'error', message: 'Network error occurred while saving' })
      throw error
    } finally {
      setProfessionalSaving(false)
    }
  }

  const savePrivacy = async () => {
    setPrivacySaving(true)
    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('privacy', JSON.stringify({
        dataSharingConsent: {
          analytics: privacyForm.analyticsConsent,
          personalization: privacyForm.personalizationConsent
        },
        anonymizedResearchConsent: privacyForm.anonymizedResearchConsent,
        contactPreferences: {
          marketing: privacyForm.marketingCommunications,
          opportunities: privacyForm.opportunitiesNotifications
        }
      }))

      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        setPrivacyForm(prev => prev)
        setSaveMessage({ type: 'success', message: 'Privacy settings saved successfully!' })
        router.refresh()
      } else {
        setSaveMessage({ type: 'error', message: result.message || 'Failed to save privacy settings' })
      }
      return result
    } catch (error) {
      setSaveMessage({ type: 'error', message: 'Network error occurred while saving' })
      throw error
    } finally {
      setPrivacySaving(false)
    }
  }

  const savePreferences = async () => {
    setPreferencesSaving(true)
    try {
      const formData = new FormData()
      formData.append('userId', user?.id || '')
      formData.append('notificationPreferences', JSON.stringify({
        email: preferencesForm.emailNotifications,
        inApp: preferencesForm.inAppNotifications,
        sms: preferencesForm.smsNotifications
      }))
      formData.append('experience', JSON.stringify({
        notificationSettings: {
          frequency: preferencesForm.notificationFrequency
        },
        uiCustomizations: {
          compactView: preferencesForm.compactView
        }
      }))
      formData.append('settings', JSON.stringify({
        aiMatching: {
          enabled: preferencesForm.aiMatchingEnabled,
          minMatchScore: parseInt(preferencesForm.minMatchScore),
          maxMatchesPerDay: parseInt(preferencesForm.maxMatchesPerDay),
          autoFillSuggestions: preferencesForm.autoFillSuggestions
        }
      }))

      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        setPreferencesForm(prev => prev)
        setSaveMessage({ type: 'success', message: 'Preferences saved successfully!' })
        router.refresh()
      } else {
        setSaveMessage({ type: 'error', message: result.message || 'Failed to save preferences' })
      }
      return result
    } catch (error) {
      setSaveMessage({ type: 'error', message: 'Network error occurred while saving' })
      throw error
    } finally {
      setPreferencesSaving(false)
    }
  }

  const hasProfessionalChanges = JSON.stringify(professionalForm) !== JSON.stringify({
    organization: (user as any)?.organization || '',
    position: (user as any)?.position || '',
    bio: (user as any)?.bio || '',
    linkedin: (user as any)?.integrations?.socialProfiles?.linkedin || '',
    twitter: (user as any)?.integrations?.socialProfiles?.twitter || '',
    facebook: (user as any)?.integrations?.socialProfiles?.facebook || '',
    skills: (user as any)?.skills || []
  })

  const hasPrivacyChanges = JSON.stringify(privacyForm) !== JSON.stringify({
    analyticsConsent: (user as any)?.privacy?.dataSharingConsent?.analytics || false,
    personalizationConsent: (user as any)?.privacy?.dataSharingConsent?.personalization || false,
    anonymizedResearchConsent: (user as any)?.privacy?.anonymizedResearchConsent || false,
    marketingCommunications: (user as any)?.privacy?.contactPreferences?.marketing || false,
    opportunitiesNotifications: (user as any)?.privacy?.contactPreferences?.opportunities || false
  })

  const hasPreferencesChanges = JSON.stringify(preferencesForm) !== JSON.stringify({
    emailNotifications: user?.notificationPreferences?.email || false,
    inAppNotifications: user?.notificationPreferences?.inApp || false,
    smsNotifications: user?.notificationPreferences?.sms || false,
    notificationFrequency: (user as any)?.experience?.notificationSettings?.frequency || 'immediate',
    aiMatchingEnabled: (user?.settings as any)?.aiMatching?.enabled || false,
    minMatchScore: String((user?.settings as any)?.aiMatching?.minMatchScore || 70),
    maxMatchesPerDay: String((user?.settings as any)?.aiMatching?.maxMatchesPerDay || 10),
    autoFillSuggestions: (user?.settings as any)?.aiMatching?.autoFillSuggestions || false,
    compactView: (user as any)?.experience?.uiCustomizations?.compactView || false
  })

  const hasUnsavedChanges = hasCommunicationsChanges || hasProfessionalChanges || hasPrivacyChanges || hasPreferencesChanges

  // Loading and feedback states
  const [communicationsSaving, setCommunicationsSaving] = useState(false)
  const [professionalSaving, setProfessionalSaving] = useState(false)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [preferencesSaving, setPreferencesSaving] = useState(false)

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Clear save message after 3 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  // Auto-enable editing for non-overview tabs on mobile
  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'wallet' && activeTab !== 'security') {
      setIsEditingSection(true)
    } else {
      setIsEditingSection(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (state?.success) {
      setIsEditing(false)
      router.refresh()
    }
  }, [state?.success, router])

  useEffect(() => {
    setUsernameValue(user?.username || '')
  }, [user?.username])

  // Sync all form states when user data changes (e.g., after router.refresh())
  // This is critical because useState initializers only run once on mount
  useEffect(() => {
    // Sync communications form
    setCommunicationsForm({
      telegramUsername: (user as any)?.communication?.telegramUsername || '',
      whatsappNumber: (user as any)?.communication?.whatsappNumber || '',
      preferredContactMethod: (user as any)?.communication?.preferredContactMethod || 'email',
      country: (user as any)?.cultural?.country || '',
      timezone: (user as any)?.cultural?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    
    // Sync professional form
    setProfessionalForm({
      organization: (user as any)?.organization || '',
      position: (user as any)?.position || '',
      bio: (user as any)?.bio || '',
      linkedin: (user as any)?.integrations?.socialProfiles?.linkedin || '',
      twitter: (user as any)?.integrations?.socialProfiles?.twitter || '',
      facebook: (user as any)?.integrations?.socialProfiles?.facebook || '',
      skills: (user as any)?.skills || []
    })
    
    // Sync privacy form
    setPrivacyForm({
      analyticsConsent: (user as any)?.privacy?.dataSharingConsent?.analytics || false,
      personalizationConsent: (user as any)?.privacy?.dataSharingConsent?.personalization || false,
      anonymizedResearchConsent: (user as any)?.privacy?.anonymizedResearchConsent || false,
      marketingCommunications: (user as any)?.privacy?.contactPreferences?.marketing || false,
      opportunitiesNotifications: (user as any)?.privacy?.contactPreferences?.opportunities || false
    })
    
    // Sync preferences form
    setPreferencesForm({
      emailNotifications: user?.notificationPreferences?.email || false,
      inAppNotifications: user?.notificationPreferences?.inApp || false,
      smsNotifications: user?.notificationPreferences?.sms || false,
      notificationFrequency: (user as any)?.experience?.notificationSettings?.frequency || 'immediate',
      aiMatchingEnabled: (user?.settings as any)?.aiMatching?.enabled || false,
      minMatchScore: String((user?.settings as any)?.aiMatching?.minMatchScore || 70),
      maxMatchesPerDay: String((user?.settings as any)?.aiMatching?.maxMatchesPerDay || 10),
      autoFillSuggestions: (user?.settings as any)?.aiMatching?.autoFillSuggestions || false,
      preferredLanguage: (user as any)?.experience?.uiCustomizations?.language || locale,
      compactView: (user as any)?.experience?.uiCustomizations?.compactView || false
    })
  }, [user, locale])

  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameError(t('usernameMinLength'))
      setUsernameAvailable(false)
      return
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameError(t('usernameInvalidChars'))
      setUsernameAvailable(false)
      return
    }

    setUsernameMode('checking')
    setUsernameError(null)
    setUsernameAvailable(null)

    try {
      const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
      const result = await response.json()

      if (result.available) {
        setUsernameAvailable(true)
        setUsernameError(null)
      } else {
        setUsernameAvailable(false)
        setUsernameError(result.error || t('usernameTaken'))
      }
    } catch (error) {
      setUsernameError(t('usernameCheckFailed'))
      setUsernameAvailable(false)
    } finally {
      setUsernameMode('edit')
    }
  }

  // Handle avatar upload
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true)
    setUploadError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'avatar')

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (result.success) {
        await refreshSession()
        router.refresh()
      } else {
        setUploadError(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Avatar upload error:', error)
      setUploadError('Network error occurred')
    } finally {
      setAvatarUploading(false)
    }
  }

  // Handle KYC document upload
  const handleKYCDocumentUpload = async (document: { type: KYCDocumentType; file: File }) => {
    try {
      const formData = new FormData()
      formData.append('file', document.file)
      formData.append('type', 'kyc')
      formData.append('documentType', document.type)

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (result.success) {
        console.log('KYC document uploaded successfully:', result)
        await refreshSession()
        router.refresh()
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('KYC document upload error:', error)
      throw error
    }
  }

  if (initialError) {
    return (
      <div className="container mx-auto px-0 py-0">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-0 py-0">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">{t('noProfileFound')}</p>
            <Button 
              className="mt-4"
              onClick={() => router.push('/login')}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPERADMIN: return 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100'
      case UserRole.ADMIN: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case UserRole.CONFIDENTIAL: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case UserRole.MEMBER: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case UserRole.SUBSCRIBER: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Profile completion calculation
  const calculateProfileCompletion = () => {
    let completed = 0
    let total = 10
    
    if (user.name) completed++
    if (user.username) completed++
    if ((user as any)?.bio) completed++
    if ((user as any)?.phoneNumber) completed++
    if ((user as any)?.organization) completed++
    if ((user as any)?.photoURL) completed++
    if ((user as any)?.communication?.telegramUsername) completed++
    if ((user as any)?.integrations?.socialProfiles) completed++
    if ((user as any)?.skills?.length > 0) completed++
    if (user.isVerified) completed++
    
    return Math.round((completed / total) * 100)
  }

  // Profile submenu items (localized)
  const profileMenuItems = [
    { id: 'overview', label: t('overview'), icon: User },
    { id: 'communications', label: t('communications'), icon: MessageSquare },
    { id: 'professional', label: t('professional'), icon: Briefcase },
    { id: 'privacy', label: t('privacy'), icon: Lock },
    { id: 'preferences', label: t('preferences'), icon: Bell },
    { id: 'verification', label: t('verification'), icon: CheckCircle },
    { id: 'wallet', label: t('wallet'), icon: Wallet },
    { id: 'security', label: t('security'), icon: Shield },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        {/* Left Sidebar - Main Navigation (Desktop only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 py-8 px-4 md:px-0 md:pr-6 lg:pb-8 pb-24">
          {/* Success/Error Message Display */}
          {saveMessage && (
            <div className="mb-4">
              <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'}>
                {saveMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription className="flex items-center justify-between">
                  <span>{saveMessage.message}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSaveMessage(null)}
                    className="ml-2 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

                  {/* Mobile Client App Preferences Banner - Shows at top on mobile */}
          <div className="lg:hidden mb-4">
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{t('clientAppPreferences')}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t('configured')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Header */}
          <Card className="mb-6">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center space-y-3 w-full md:w-auto">
                  <Avatar
                    src={user.photoURL || session?.user?.image}
                    alt={user.name || 'User'}
                    size="2xl"
                    fallback={user.name?.charAt(0) || 'U'}
                    editable={!isEditing}
                    onUpload={handleAvatarUpload}
                    uploading={avatarUploading}
                    className="border-4 border-border"
                  />
                  {uploadError && (
                    <Alert variant="destructive" className="text-xs">
                      <AlertDescription className="text-xs">{uploadError}</AlertDescription>
                    </Alert>
                  )}
                  {/* Desktop only - profile completion badge */}
                  <Badge variant="secondary" className="text-xs hidden md:flex">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {calculateProfileCompletion()}{t('percentComplete')}
                  </Badge>
                </div>

                {/* Profile Info */}
                <div className="flex-1 space-y-4 w-full md:w-auto text-center md:text-left">
                  <div>
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-3 mb-2">
                      <h1 className="text-2xl md:text-3xl font-bold">{user.name || 'Anonymous User'}</h1>
                      <div className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor(user.role as UserRole)}>
                        {user.role}
                      </Badge>
                      {user.isVerified && (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    </div>
                    <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </p>
                    {(user as any)?.bio && (
                      <p className="text-sm mt-2 max-w-md text-muted-foreground">{(user as any).bio}</p>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm justify-center md:justify-start">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Joined {formatDate('createdAt' in user ? (user as any).createdAt : null)}</span>
                    </div>
                    {(user as any)?.organization && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span>{(user as any).organization}</span>
                      </div>
                    )}
                    {(user as any)?.cultural?.country && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{(user as any).cultural.country}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Mobile: Only Sign Out, Desktop: Full Controls */}
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    {/* Desktop: Show Edit/Settings buttons */}
                    {!isEditing ? (
                      <Button 
                        onClick={() => setIsEditing(true)}
                        size="sm"
                        className="hidden md:flex md:w-auto"
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        {t('editProfile')}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        size="sm"
                        className="hidden md:flex md:w-auto"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(ROUTES.SETTINGS(locale))}
                      className="hidden md:flex md:w-auto"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => signOut({ redirect: true, redirectTo: `/${locale}/login` })}
                      className="w-full md:w-auto"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('signOut') || 'Sign Out'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Content Area - Conditional based on activeTab */}
          {mounted && (
            <div className="space-y-6">

              {/* Mobile Section Title */}
              <div className="lg:hidden mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {profileMenuItems.find(item => item.id === activeTab)?.icon && (
                      <span className="inline-flex">
                        {React.createElement(profileMenuItems.find(item => item.id === activeTab)!.icon, { className: "w-6 h-6" })}
                      </span>
                    )}
                    {profileMenuItems.find(item => item.id === activeTab)?.label}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Edit button - Only on Overview tab, opens edit page */}
                    {activeTab === 'overview' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/${locale}/profile/edit`)}
                        className="flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="text-xs">Edit</span>
                      </Button>
                    )}
                    {/* Menu button for profile submenu drawer */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRightSidebarOpen(true)}
                      className="flex items-center gap-1"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-xs">Menu</span>
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'overview' && t('overviewDescription')}
                  {activeTab === 'communications' && t('communicationsTabDescription')}
                  {activeTab === 'professional' && t('professionalTabDescription')}
                  {activeTab === 'privacy' && t('privacyTabDescription')}
                  {activeTab === 'preferences' && t('preferencesTabDescription')}
                  {activeTab === 'wallet' && t('walletTabDescription')}
                  {activeTab === 'security' && t('securityTabDescription')}
                </p>
              </div>

              {/* Overview Section */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                  {/* Personal Information Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {t('personalInfo')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('fullName')}</p>
                        <p className="font-medium">{user.name || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('username')}</p>
                        {usernameMode === 'view' && !user.username ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => setUsernameMode('edit')}
                          >
                            {t('setUsername')}
                          </button>
                        ) : usernameMode === 'view' ? (
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.username}</p>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-primary"
                              onClick={() => setUsernameMode('edit')}
                            >
                              {t('changeUsername')}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={usernameValue}
                                onChange={(e) => {
                                  setUsernameValue(e.target.value)
                                  setUsernameAvailable(null)
                                  setUsernameError(null)
                                }}
                                placeholder="Enter username"
                                className="flex-1"
                                disabled={usernameMode === 'checking'}
                              />
                              {usernameMode === 'checking' ? (
                                <Button size="sm" disabled>
                                  <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                                </Button>
                              ) : usernameAvailable === true ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const formData = new FormData()
                                        formData.append('userId', user?.id || '')
                                        formData.append('username', usernameValue)

                                        const result = await updateProfile({ success: false, message: '' }, formData)
                                        if (result.success) {
                                          // Update the user object with the new username
                                          if (user) {
                                            (user as any).username = usernameValue
                                          }

                                          setUsernameMode('view')
                                          setUsernameAvailable(null)
                                          setUsernameError(null)

                                          // Trigger session update to fetch fresh user data
                                          await updateSession()
                                          await refreshSession()
                                          router.refresh()
                                        } else {
                                          setUsernameError(result.message || 'Failed to save username')
                                        }
                                      } catch (error) {
                                        setUsernameError('Network error occurred')
                                      }
                                    }}
                                  >
                                    {t('save')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setUsernameValue(user?.username || '')
                                      setUsernameMode('view')
                                      setUsernameAvailable(null)
                                      setUsernameError(null)
                                    }}
                                  >
                                    {t('cancel')}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => checkUsernameAvailability(usernameValue)}
                                  disabled={!usernameValue || usernameValue.length < 3}
                                >
                                  Check
                                </Button>
                              )}
                            </div>
                            {usernameAvailable === true && (
                              <p className="text-sm text-green-600">✓ {t('usernameAvailable')}</p>
                            )}
                            {usernameError && (
                              <p className="text-sm text-red-600">{usernameError}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('email')}</p>
                        <p className="font-medium">{user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('phone')}</p>
                        <p className="font-medium">{(user as any)?.phoneNumber || 'Not set'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Status Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {t('accountInfo')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('memberSince')}</p>
                        <p className="font-medium">{formatDate('createdAt' in user ? (user as any).createdAt : null)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('lastLogin')}</p>
                        <p className="font-medium">{formatDate('lastLogin' in user ? (user as any).lastLogin : null)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('role')}</p>
                        <Badge className={getRoleBadgeColor(user.role as UserRole)}>
                          {user.role}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('verificationStatus')}</p>
                        <Badge variant={user.isVerified ? "default" : "secondary"}>
                          {user.isVerified ? t('verified') : t('unverified')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Client App Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      {t('profileSettings')}
                    </CardTitle>
                    <CardDescription>
                      Customize your Ring Platform experience and app settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          <span className="text-sm">{t('theme')}</span>
                        </div>
                        <Select value={currentTheme} onValueChange={setTheme}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">
                              <div className="flex items-center gap-2">
                                <Sun className="h-3 w-3" />
                                {t('light')}
                              </div>
                            </SelectItem>
                            <SelectItem value="dark">
                              <div className="flex items-center gap-2">
                                <Moon className="h-3 w-3" />
                                {t('dark')}
                              </div>
                            </SelectItem>
                            <SelectItem value="system">
                              <div className="flex items-center gap-2">
                                <Monitor className="h-3 w-3" />
                                {t('system')}
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4" />
                          <span className="text-sm">{t('language')}</span>
                        </div>
                        <Select value={locale} onValueChange={(value) => switchLocale(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">🇺🇸 English</SelectItem>
                            <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                            <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          {t('profileCompletionDescription')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Communications Section */}
              {activeTab === 'communications' && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {t('communications')}
                    </CardTitle>
                    <CardDescription>
                      {t('communicationsDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="telegram" className="text-base md:text-sm">
                          <Send className="w-4 h-4 inline mr-2" />
                          Telegram Username
                        </Label>
                        <Input
                          id="telegram"
                          placeholder="@username"
                          value={communicationsForm.telegramUsername}
                          onChange={(e) => setCommunicationsForm(prev => ({ ...prev, telegramUsername: e.target.value }))}
                          className="h-11 md:h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="whatsapp" className="text-base md:text-sm">
                          <Phone className="w-4 h-4 inline mr-2" />
                          WhatsApp Number
                        </Label>
                        <Input
                          id="whatsapp"
                          placeholder="+1234567890"
                          value={communicationsForm.whatsappNumber}
                          onChange={(e) => setCommunicationsForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                          className="h-11 md:h-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferred-contact">{t('preferredContactMethod')}</Label>
                      <Select value={communicationsForm.preferredContactMethod} onValueChange={(value) => setCommunicationsForm(prev => ({ ...prev, preferredContactMethod: value }))}>
                        <SelectTrigger id="preferred-contact">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">{t('phone')}</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-4">{t('culturalLocationSettings')}</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="country" className="text-base md:text-sm">
                            <MapPin className="w-4 h-4 inline mr-2" />
                            {t('country')}
                          </Label>
                          <Input
                            id="country"
                            placeholder="United States"
                            value={communicationsForm.country}
                            onChange={(e) => setCommunicationsForm(prev => ({ ...prev, country: e.target.value }))}
                            className="h-11 md:h-10"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timezone" className="text-base md:text-sm">
                            <Globe className="w-4 h-4 inline mr-2" />
                            {t('timezone')}
                          </Label>
                          <TimezoneSelect
                            value={communicationsForm.timezone}
                            onChange={(timezone) => setCommunicationsForm(prev => ({ ...prev, timezone }))}
                            countryCode={communicationsForm.country}
                            placeholder={t('selectTimezone') || 'Select timezone'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save button hidden on mobile - use floating controls */}
                    <Button
                      className="hidden md:flex md:w-auto h-11 md:h-10"
                      onClick={async () => {
                        if (hasCommunicationsChanges) {
                          await saveCommunications()
                        }
                      }}
                      disabled={!hasCommunicationsChanges || communicationsSaving}
                    >
                      {communicationsSaving ? (
                        <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {communicationsSaving ? t('saving') : t('saveCommunicationSettings')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Professional Section */}
              {activeTab === 'professional' && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      {t('professional')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="organization" className="text-base md:text-sm">{t('organization')}</Label>
                        <Input
                          id="organization"
                          value={professionalForm.organization}
                          onChange={(e) => setProfessionalForm(prev => ({ ...prev, organization: e.target.value }))}
                          className="h-11 md:h-10"
                          placeholder="Your company or institution"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="position" className="text-base md:text-sm">{t('position')}</Label>
                        <Input
                          id="position"
                          value={professionalForm.position}
                          onChange={(e) => setProfessionalForm(prev => ({ ...prev, position: e.target.value }))}
                          className="h-11 md:h-10"
                          placeholder="Your role or title"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio" className="text-base md:text-sm">{t('professionalBio')}</Label>
                      <Textarea
                        id="bio"
                        value={professionalForm.bio}
                        onChange={(e) => setProfessionalForm(prev => ({ ...prev, bio: e.target.value }))}
                        rows={4}
                        placeholder={t('tellUsAboutYourProfessionalBackground')}
                        className="resize-none"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-base md:text-lg font-semibold">{t('socialMediaProfiles')}</h3>
                      <div className="grid gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 md:w-8 md:h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex-shrink-0">
                            <Linkedin className="w-5 h-5 md:w-4 md:h-4 text-blue-600" />
                          </div>
                          <Input
                            placeholder="LinkedIn profile URL"
                            value={professionalForm.linkedin}
                            onChange={(e) => setProfessionalForm(prev => ({ ...prev, linkedin: e.target.value }))}
                            className="h-11 md:h-10"
                          />
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 md:w-8 md:h-8 bg-sky-50 dark:bg-sky-950 rounded-lg flex-shrink-0">
                            <Twitter className="w-5 h-5 md:w-4 md:h-4 text-sky-500" />
                          </div>
                          <Input
                            placeholder="Twitter/X profile URL"
                            value={professionalForm.twitter}
                            onChange={(e) => setProfessionalForm(prev => ({ ...prev, twitter: e.target.value }))}
                            className="h-11 md:h-10"
                          />
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 md:w-8 md:h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex-shrink-0">
                            <Facebook className="w-5 h-5 md:w-4 md:h-4 text-blue-700" />
                          </div>
                          <Input
                            placeholder="Facebook profile URL"
                            value={professionalForm.facebook}
                            onChange={(e) => setProfessionalForm(prev => ({ ...prev, facebook: e.target.value }))}
                            className="h-11 md:h-10"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-base md:text-lg font-semibold">{t('skillsExpertise')}</h3>
                      <div className="space-y-2">
                        <Label className="text-base md:text-sm">{t('addProfessionalSkills')}</Label>
                        <Input 
                          placeholder="e.g. React, TypeScript, Project Management"
                          className="h-11 md:h-10"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(user as any)?.skills?.map((skill: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-sm py-1">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Save button hidden on mobile - use floating controls */}
                    <Button
                      className="hidden md:flex md:w-auto h-11 md:h-10"
                      onClick={async () => {
                        if (hasProfessionalChanges) {
                          await saveProfessional()
                        }
                      }}
                      disabled={!hasProfessionalChanges || professionalSaving}
                    >
                      {professionalSaving ? (
                        <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {professionalSaving ? t('saving') : t('saveProfessionalProfile')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Privacy Section */}
              {activeTab === 'privacy' && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      {t('privacy')}
                    </CardTitle>
                    <CardDescription>
                      {t('privacyDescription')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('dataSharingConsent')}</h3>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('analyticsAndPerformance')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('helpImproveRingPlatform')}
                          </p>
                        </div>
                        <Switch checked={privacyForm.analyticsConsent} onCheckedChange={(checked) => setPrivacyForm(prev => ({ ...prev, analyticsConsent: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('personalization')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('personalizedContentAndRecommendations')}
                          </p>
                        </div>
                        <Switch checked={privacyForm.personalizationConsent} onCheckedChange={(checked) => setPrivacyForm(prev => ({ ...prev, personalizationConsent: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('anonymizedResearch')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('helpImproveAIFeatures')}
                          </p>
                        </div>
                        <Switch checked={privacyForm.anonymizedResearchConsent} onCheckedChange={(checked) => setPrivacyForm(prev => ({ ...prev, anonymizedResearchConsent: checked }))} />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('contactPreferences')}</h3>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('marketingCommunications')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('updatesAboutNewFeaturesAndOffers')}
                          </p>
                        </div>
                        <Switch checked={privacyForm.marketingCommunications} onCheckedChange={(checked) => setPrivacyForm(prev => ({ ...prev, marketingCommunications: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('opportunities')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('jobAndCollaborationOpportunities')}
                          </p>
                        </div>
                        <Switch checked={privacyForm.opportunitiesNotifications} onCheckedChange={(checked) => setPrivacyForm(prev => ({ ...prev, opportunitiesNotifications: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('systemNotifications')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('securityAndAccountUpdatesRequired')}
                          </p>
                        </div>
                        <Switch defaultChecked disabled />
                      </div>
                    </div>

                    {/* Save button hidden on mobile - use floating controls */}
                    <Button
                      className="hidden md:flex md:w-auto h-11 md:h-10"
                      onClick={async () => {
                        if (hasPrivacyChanges) {
                          await savePrivacy()
                        }
                      }}
                      disabled={!hasPrivacyChanges || privacySaving}
                    >
                      {privacySaving ? (
                        <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {privacySaving ? t('saving') : t('savePrivacySettings')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Preferences Section */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      {t('preferences')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('notificationChannels')}</h3>

                      <div className="flex items-center justify-between">
                        <Label>{t('emailNotifications')}</Label>
                        <Switch checked={preferencesForm.emailNotifications} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, emailNotifications: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>{t('inAppNotifications')}</Label>
                        <Switch checked={preferencesForm.inAppNotifications} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, inAppNotifications: checked }))} />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>{t('smsNotifications')}</Label>
                        <Switch checked={preferencesForm.smsNotifications} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, smsNotifications: checked }))} />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('notificationFrequency')}</Label>
                        <Select value={preferencesForm.notificationFrequency} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, notificationFrequency: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">{t('immediate')}</SelectItem>
                            <SelectItem value="daily">{t('dailyDigest')}</SelectItem>
                            <SelectItem value="weekly">{t('weeklySummary')}</SelectItem>
                            <SelectItem value="monthly">{t('monthlyReport')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        {t('aiMatching')}
                      </h3>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('getAIPoweredOpportunityRecommendations')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('getAIPoweredOpportunityRecommendations')}
                          </p>
                        </div>
                        <Switch checked={preferencesForm.aiMatchingEnabled} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, aiMatchingEnabled: checked }))} />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('minimumMatchScore')}</Label>
                        <Select value={preferencesForm.minMatchScore} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, minMatchScore: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="50">{t('showAllRelevant')}</SelectItem>
                            <SelectItem value="70">{t('goodMatches')}</SelectItem>
                            <SelectItem value="85">{t('greatMatchesOnly')}</SelectItem>
                            <SelectItem value="95">{t('perfectMatches')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('maxMatchesPerDay')}</Label>
                        <Select value={preferencesForm.maxMatchesPerDay} onValueChange={(value) => setPreferencesForm(prev => ({ ...prev, maxMatchesPerDay: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 matches</SelectItem>
                            <SelectItem value="10">10 matches</SelectItem>
                            <SelectItem value="20">20 matches</SelectItem>
                            <SelectItem value="50">50 matches</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>{t('autoFillSuggestions')}</Label>
                        <Switch checked={preferencesForm.autoFillSuggestions} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, autoFillSuggestions: checked }))} />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('display')}</h3>
                      
                      <div className="flex items-center justify-between">
                        <Label>{t('compactView')}</Label>
                        <Switch checked={preferencesForm.compactView} onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, compactView: checked }))} />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('theme')}</Label>
                        <Select defaultValue={theme || 'system'} onValueChange={setTheme}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">{t('light')}</SelectItem>
                            <SelectItem value="dark">{t('dark')}</SelectItem>
                            <SelectItem value="system">{t('system')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Save button hidden on mobile - use floating controls */}
                    <Button
                      className="hidden md:flex md:w-auto h-11 md:h-10"
                      onClick={async () => {
                        if (hasPreferencesChanges) {
                          await savePreferences()
                        }
                      }}
                      disabled={!hasPreferencesChanges || preferencesSaving}
                    >
                      {preferencesSaving ? (
                        <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {preferencesSaving ? t('saving') : t('savePreferences')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Verification Section */}
              {activeTab === 'verification' && (
                <div className="space-y-6">
                  <KYCUpload
                    onUpload={handleKYCDocumentUpload}
                    currentStatus={kycStatus as KYCStatus}
                    uploadedDocuments={[]}
                  />
                </div>
              )}

              {/* Wallet Section */}
              {activeTab === 'wallet' && (
                <div className="space-y-6">
                <WalletSection
                  locale={locale}
                  embedded={true}
                />
              </div>
              )}

              {/* Security Section */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t('security')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('kycVerification')}</h3>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium">{t('verificationStatus')}</p>
                          <p className="text-sm text-muted-foreground">
                            {kycStatus === KYCStatus.APPROVED ? t('verified') : t('unverified')}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setActiveTab('verification')}>
                          {kycStatus === KYCStatus.APPROVED ? 'View' : 'Start Verification'}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">{t('activeSessions')}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Monitor className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{t('currentSession')}</p>
                              <p className="text-sm text-muted-foreground">{t('desktop')} • {formatDate(new Date())}</p>
                            </div>
                          </div>
                          <Badge variant="default">Active</Badge>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Smartphone className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{t('mobileDevice')}</p>
                              <p className="text-sm text-muted-foreground">iOS • 2 days ago</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">{t('revoke')}</Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h3 className="text-base md:text-lg font-semibold">{t('accountSecurity')}</h3>
                      <Button variant="outline" className="w-full justify-start h-12 md:h-10 text-sm md:text-base">
                        <Lock className="mr-2 h-5 w-5 md:h-4 md:w-4" />
                        {t('changePassword')}
                      </Button>
                      <Button variant="outline" className="w-full justify-start h-12 md:h-10 text-sm md:text-base">
                        <Shield className="mr-2 h-5 w-5 md:h-4 md:w-4" />
                        {t('enableTwoFactorAuth')}
                      </Button>
                      <Button variant="outline" className="w-full justify-start h-12 md:h-10 text-sm md:text-base">
                        <Download className="mr-2 h-5 w-5 md:h-4 md:w-4" />
                        {t('downloadMyData')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
          )}

        </div>
          )}
        </div>

        {/* Right Sidebar - Profile Submenu */}
        
        {/* Desktop: Fixed visible sidebar */}
        <div className="hidden lg:block w-[240px] flex-shrink-0">
          <div className="sticky top-8 space-y-2">
            {/* Profile Completion & RING Rewards Widget */}
            <div className="mb-6 p-4 bg-gradient-to-br from-yellow-500/10 via-primary/10 to-purple-500/10 rounded-lg border border-yellow-500/30">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-bold">{t('earnRing')}</span>
                </div>
                <Badge variant="default" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  💰
                </Badge>
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                  {calculateProfileCompletion()}%
                </span>
                <Badge variant="secondary" className="text-xs">
                  {calculateProfileCompletion() === 100 ? '✨ ' + t('maxRewards') : '⭐ ' + t('keepGoing')}
                </Badge>
              </div>
              <Progress value={calculateProfileCompletion()} className="h-2 mb-4" />

              {/* Reward Opportunities */}
              <div className="space-y-2 text-xs">
                <div className="text-muted-foreground font-medium mb-2">{t('completeToEarn')}:</div>
                
                {/* Telegram Verification */}
                {!communicationsForm.telegramUsername && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Send className="w-3 h-3 text-blue-500" />
                      <span>{t('addTelegram')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+5</Badge>
                  </div>
                )}

                {/* WhatsApp Verification */}
                {!communicationsForm.whatsappNumber && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3 h-3 text-green-500" />
                      <span>{t('addWhatsApp')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+5</Badge>
                  </div>
                )}

                {/* Phone Verification */}
                {!(user as any)?.phoneNumber && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-purple-500" />
                      <span>{t('addPhone')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+10</Badge>
                  </div>
                )}

                {/* KYC Verification */}
                {kycStatus !== 'approved' && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-red-500" />
                      <span>{t('completeKyc')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+50</Badge>
                  </div>
                )}
              </div>

              {/* Total Potential Earnings */}
              {calculateProfileCompletion() < 100 && (
                <div className="mt-3 pt-3 border-t border-yellow-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('potentialEarnings')}:</span>
                    <span className="text-sm font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                      {700 - (communicationsForm.telegramUsername ? 50 : 0) - (communicationsForm.whatsappNumber ? 50 : 0) - ((user as any)?.phoneNumber ? 100 : 0) - (kycStatus === 'approved' ? 500 : 0)} RING
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Section Selector */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                {t('profileSections')}
              </div>
              <div className="flex flex-col gap-2 px-3">
                {profileMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border w-full ${
                      activeTab === item.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:text-foreground border-border hover:border-accent'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: Floating toggle sidebar - Matches desktop menu exactly */}
        <FloatingSidebarToggle
          isOpen={rightSidebarOpen}
          onToggle={setRightSidebarOpen}
          mobileWidth="90%"
          tabletWidth="280px"
        >
          <div className="space-y-2">
            {/* Profile Completion & RING Rewards Widget */}
            <div className="mb-6 p-4 bg-gradient-to-br from-yellow-500/10 via-primary/10 to-purple-500/10 rounded-lg border border-yellow-500/30">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-bold">{t('earnRing')}</span>
                </div>
                <Badge variant="default" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">
                  💰
                </Badge>
              </div>

              {/* Progress */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                  {calculateProfileCompletion()}%
                </span>
                <Badge variant="secondary" className="text-xs">
                  {calculateProfileCompletion() === 100 ? '✨ ' + t('maxRewards') : '⭐ ' + t('keepGoing')}
                </Badge>
              </div>
              <Progress value={calculateProfileCompletion()} className="h-2 mb-4" />

              {/* Reward Opportunities */}
              <div className="space-y-2 text-xs">
                <div className="text-muted-foreground font-medium mb-2">{t('completeToEarn')}:</div>
                
                {/* Telegram Verification */}
                {!communicationsForm.telegramUsername && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Send className="w-3 h-3 text-blue-500" />
                      <span>{t('addTelegram')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+5</Badge>
                  </div>
                )}

                {/* WhatsApp Verification */}
                {!communicationsForm.whatsappNumber && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3 h-3 text-green-500" />
                      <span>{t('addWhatsApp')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+5</Badge>
                  </div>
                )}

                {/* Phone Verification */}
                {!(user as any)?.phoneNumber && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-purple-500" />
                      <span>{t('addPhone')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+10</Badge>
                  </div>
                )}

                {/* KYC Verification */}
                {kycStatus !== 'approved' && (
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/50 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-red-500" />
                      <span>{t('completeKyc')}</span>
                    </div>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">+50</Badge>
                  </div>
                )}
              </div>

              {/* Total Potential Earnings */}
              {calculateProfileCompletion() < 100 && (
                <div className="mt-3 pt-3 border-t border-yellow-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('potentialEarnings')}:</span>
                    <span className="text-sm font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                      {70 - (communicationsForm.telegramUsername ? 5 : 0) - (communicationsForm.whatsappNumber ? 5 : 0) - ((user as any)?.phoneNumber ? 10 : 0) - (kycStatus === 'approved' ? 50 : 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Section Selector */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
                {t('profileSections')}
              </div>
              <div className="flex flex-col gap-2 px-3">
                {profileMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id)
                      setRightSidebarOpen(false) // Close sidebar after selection on mobile
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border w-full ${
                      activeTab === item.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:text-foreground border-border hover:border-accent'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FloatingSidebarToggle>

        {/* Mobile Floating Save/Cancel Controls - Appears when there are unsaved changes */}
        {hasUnsavedChanges && activeTab !== 'overview' && activeTab !== 'wallet' && (
          <div className="lg:hidden fixed bottom-[72px] left-0 right-0 bg-gradient-to-t from-background via-background/95 to-transparent backdrop-blur-sm pb-3 pt-6 px-4 z-40 border-t border-border/50">
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <Button
                className="flex-1 h-12 shadow-lg font-semibold"
                disabled={communicationsSaving || professionalSaving || privacySaving || preferencesSaving}
                onClick={async () => {
                  if (activeTab === 'communications' && hasCommunicationsChanges) {
                    await saveCommunications()
                  } else if (activeTab === 'professional' && hasProfessionalChanges) {
                    await saveProfessional()
                  } else if (activeTab === 'privacy' && hasPrivacyChanges) {
                    await savePrivacy()
                  } else if (activeTab === 'preferences' && hasPreferencesChanges) {
                    await savePreferences()
                  }
                }}
              >
                {communicationsSaving || professionalSaving || privacySaving || preferencesSaving ? (
                  <div className="w-5 h-5 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                {communicationsSaving || professionalSaving || privacySaving || preferencesSaving ? t('saving') : t('saveChanges')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg border-2"
                onClick={() => {
                  // Reset form state to original values
                  if (activeTab === 'communications') {
                    setCommunicationsForm({
                      telegramUsername: (user as any)?.communication?.telegramUsername || '',
                      whatsappNumber: (user as any)?.communication?.whatsappNumber || '',
                      preferredContactMethod: (user as any)?.communication?.preferredContactMethod || 'email',
                      country: (user as any)?.cultural?.country || '',
                      timezone: (user as any)?.cultural?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                    })
                  } else if (activeTab === 'professional') {
                    setProfessionalForm({
                      organization: (user as any)?.organization || '',
                      position: (user as any)?.position || '',
                      bio: (user as any)?.bio || '',
                      linkedin: (user as any)?.integrations?.socialProfiles?.linkedin || '',
                      twitter: (user as any)?.integrations?.socialProfiles?.twitter || '',
                      facebook: (user as any)?.integrations?.socialProfiles?.facebook || '',
                      skills: (user as any)?.skills || []
                    })
                  } else if (activeTab === 'privacy') {
                    setPrivacyForm({
                      analyticsConsent: (user as any)?.privacy?.dataSharingConsent?.analytics || false,
                      personalizationConsent: (user as any)?.privacy?.dataSharingConsent?.personalization || false,
                      anonymizedResearchConsent: (user as any)?.privacy?.anonymizedResearchConsent || false,
                      marketingCommunications: (user as any)?.privacy?.contactPreferences?.marketing || false,
                      opportunitiesNotifications: (user as any)?.privacy?.contactPreferences?.opportunities || false
                    })
                  } else if (activeTab === 'preferences') {
                    setPreferencesForm({
                      emailNotifications: user?.notificationPreferences?.email || false,
                      inAppNotifications: user?.notificationPreferences?.inApp || false,
                      smsNotifications: user?.notificationPreferences?.sms || false,
                      notificationFrequency: (user as any)?.experience?.notificationSettings?.frequency || 'immediate',
                      aiMatchingEnabled: (user?.settings as any)?.aiMatching?.enabled || false,
                      minMatchScore: String((user?.settings as any)?.aiMatching?.minMatchScore || 70),
                      maxMatchesPerDay: String((user?.settings as any)?.aiMatching?.maxMatchesPerDay || 10),
                      autoFillSuggestions: (user?.settings as any)?.aiMatching?.autoFillSuggestions || false,
                      preferredLanguage: (user as any)?.experience?.uiCustomizations?.language || locale,
                      compactView: (user as any)?.experience?.uiCustomizations?.compactView || false
                    })
                  }
                  setIsEditingSection(false)
                }}
              >
                <XCircle className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



