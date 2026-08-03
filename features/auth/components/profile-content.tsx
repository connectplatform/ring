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
import dynamic from 'next/dynamic'
import { useRouter } from '@/i18n/routing'
import { useTranslations, useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { ProfileContentProps } from '@/types/profile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KYCStatus, KYCLevel, KYCDocumentType } from '@/features/auth/types'
import KYCUpload from './kyc-upload'
import { UserRolesArray } from '@/features/auth/user-role'
import { useAuth } from '@/hooks/use-auth'
import { useSession } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import ProfileNavRail from '@/components/profile/profile-nav-rail'
import {
  User,
  Mail,
  Shield,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  Settings,
  Building,
  MapPin,
  Award,
  LogOut,
  Sparkles,
  Lock,
  Monitor,
  Smartphone,
  Download,
  Briefcase,
  MessageSquare,
  Send,
  Phone,
  Globe,
  Medal,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import BioEditModal from './bio-edit-modal'
import SetUsernameModal from './set-username-modal'
import { PersonalPageWidget } from './personal-page-widget'
import { ShareEarnWidget } from './share-earn-widget'
import {
  acceptsProfileDms,
  normalizePublicProfileFields,
  type PublicProfileFieldsMap,
} from '@/features/auth/lib/personal-page-sections'
import TimezoneSelectorModal from './timezone-selector-modal'
const LocationMapModal = dynamic(
  () => import('./location-map-modal'),
  { ssr: false }
)
import TelegramLinkingModal from './telegram-linking-modal'
import {
  formatTelegramProfileLabel,
  isTelegramLinked,
} from '@/lib/auth/telegram-profile'
import { SessionForensicsWidget } from './session-forensics-widget'
import { UserProgressWidget } from './user-progress-widget'
import { ProfileHeroBalances } from './profile-hero-balances'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { AuthUser } from '@/features/auth/types'

function isPublicProfileEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function readPublicProfile(userLike: unknown): boolean {
  if (!userLike || typeof userLike !== 'object') return false
  return isPublicProfileEnabled((userLike as { publicProfile?: unknown }).publicProfile)
}

function readPublicProfileSections(userLike: unknown): string[] | undefined {
  if (!userLike || typeof userLike !== 'object') return undefined
  const sections = (userLike as { publicProfileSections?: unknown }).publicProfileSections
  return Array.isArray(sections) ? (sections as string[]) : undefined
}

function readPublicProfileFields(userLike: unknown): PublicProfileFieldsMap {
  if (!userLike || typeof userLike !== 'object') return {}
  return normalizePublicProfileFields(
    (userLike as { publicProfileFields?: unknown }).publicProfileFields,
  )
}

function readAcceptProfileDms(userLike: unknown): boolean {
  if (!userLike || typeof userLike !== 'object') return true
  return acceptsProfileDms((userLike as { acceptProfileDms?: unknown }).acceptProfileDms)
}

// TODO: Refactor for React 19 and Next.js 15/16 codemods:
// - Consider switching to useOptimistic for profile update flows
// - Use useEffectEvent for effect event callback ref stability
// - Move some sections to Server Components for partial render optimization (where server side data fetch is best, e.g. wallet/widgets)
// - Use Server Actions for saving profile/bio changes, etc.
// - Reduce unnecessary effects with useDeferredValue/useTransition for transitions
// - If context: consider useContextSelector for opt-in fine-grained context update (where needed)

export default function ProfileContent({ 
  initialUser, 
  initialError, 
  params, 
  searchParams,
  session,
  updateProfile 
}: ProfileContentProps) {
  // Locales, translations, context hooks
  const locale = useLocale() as Locale
  const t = useTranslations('modules.profile')
  const router = useRouter()
  const { getKycStatus, refreshSession, signOut } = useAuth()
  const { update: updateSession } = useSession() // TODO: Consider React 19 cache API and server-initiated data
  const [isEditing, setIsEditing] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  // Priority: initialUser (preferred, freshly fetched) > session user
  const user = initialUser || session?.user
  // Current user's KYC status - always from auth context for up-to-date info
  const kycStatus = getKycStatus()
  // State for holding user's KYC (Know Your Customer) verification procedure
  const [verificationProcedure, setVerificationProcedure] = useState<{
    procedureNumber: string
    status: string
    documents: Array<{
      id: string
      documentType: string
      fileName: string
      uploadedAt: string
      status: string
    }>
  } | null>(null)

  /**
   * Map backend KYC verification procedure status to user-facing KYCStatus enum
   * Ensures UI-consistent representation regardless of underlying string value
   */
  const mapProcedureStatusToKyc = (status?: string): KYCStatus => {
    switch (status) {
      case 'submitted':
        return KYCStatus.PENDING
      case 'under_review':
        return KYCStatus.UNDER_REVIEW
      case 'approved':
        return KYCStatus.APPROVED
      case 'rejected':
        return KYCStatus.REJECTED
      case 'expired':
        return KYCStatus.EXPIRED
      default:
        return kycStatus as KYCStatus // fallback to current context value
    }
  }

  /**
   * Fetch (GET) current user's verification procedure for KYC from API,
   * and update local state on success. Memoized with useCallback.
   */
  const loadVerificationProcedure = useCallback(async () => {
    try {
      const response = await fetch('/api/verification/procedures/me?subjectType=user_kyc')
      const result = await response.json()
      if (result.success && result.procedure) {
        setVerificationProcedure(result.procedure)
      }
    } catch (error) {
      // TODO: Expose fetch errors with UI for support/debug (for now, console only)
      console.error('Failed to load verification procedure:', error)
    }
  }, [])

  /**
   * Effect: Whenever switching to 'verification' tab, load latest procedure info.
   */
  useEffect(() => {
    if (activeTab === 'verification') {
      void loadVerificationProcedure()
    }
  }, [activeTab, loadVerificationProcedure])

  // Track UI mounting (for hydration safety and to SSR-safe render only after client)
  const [mounted, setMounted] = useState(Boolean(initialUser))
  // Track state of profile menu sidebar for mobile/desktop
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  // User-facing notification banner state (success/error)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modal open states (each managed individually)
  const [bioEditModalOpen, setBioEditModalOpen] = useState(false)
  const [setUsernameModalOpen, setSetUsernameModalOpen] = useState(false)
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [telegramLinking, setTelegramLinking] = useState(false)
  const [telegramUnlinking, setTelegramUnlinking] = useState(false)

  // Security/session forensics: list of recent authentication sessions
  const [forensicsEntries, setForensicsEntries] = useState<any[]>([])
  const [forensicsLoading, setForensicsLoading] = useState(false)

  /**
   * Effect: When security tab is opened and entries not loaded yet, fetch session forensics
   * Loads via dynamic import for code splitting (_actions/session-forensics)
   */
  useEffect(() => {
    if (activeTab === 'security' && forensicsEntries.length === 0) {
      setForensicsLoading(true)
      import('@/app/_actions/session-forensics')
        .then((m) => m.getSessionForensics())
        .then((data) => setForensicsEntries(data))
        .catch(() => {}) // TODO: Show error banner for auth/session forensics errors
        .finally(() => setForensicsLoading(false))
    }
  }, [activeTab, forensicsEntries.length])

  /**
   * Phone formatting utility (e.g. "+1 310 555 0123"). Falls back to original on parse fail.
   */
  const formatPhone = (phone: string): string => {
    try {
      const parsed = parsePhoneNumberFromString(phone)
      if (parsed && parsed.isValid()) return parsed.formatInternational()
      return phone
    } catch {
      return phone
    }
  }

  // On mount, set hydrated flag
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show save message for 3s then auto-clear
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  /**
   * Upload a new avatar image for the user. Handles file upload and UI feedback.
   */
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true)
    setUploadError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'avatar')
      formData.append('purpose', 'profile:avatar')

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (result.success) {
        const thumb =
          result.derivatives?.sync_thumb ||
          result.derivatives?.thumb ||
          result.url
        // Patch JWT immediately so MobileUserWidget / sidebar chrome update without re-login
        await updateSession({
          photoURL: result.url || thumb,
          image: thumb || result.url,
          avatarThumb: thumb,
        })
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

  /**
   * Upload and attach a KYC document for identity verification
   * 1. Start the verification procedure (POST)
   * 2. Upload document binary
   * 3. Attach document to procedure (POST) 
   * 4. Refresh procedure and session state
   */
  const handleKYCDocumentUpload = async (document: { type: KYCDocumentType; file: File }) => {
    try {
      // Step 1: Bootstrap procedure
      const bootstrap = await fetch('/api/verification/procedures/me?subjectType=user_kyc', {
        method: 'POST',
      })
      const bootstrapResult = await bootstrap.json()
      if (!bootstrapResult.success || !bootstrapResult.procedure?.procedureNumber) {
        throw new Error(bootstrapResult.error || 'Failed to start verification procedure')
      }

      const procedureNumber = bootstrapResult.procedure.procedureNumber as string

      // Step 2: Upload document file
      const formData = new FormData()
      formData.append('file', document.file)
      formData.append('type', 'kyc')
      formData.append('documentType', document.type)
      formData.append('purpose', 'profile:kyc')
      formData.append('fileType', document.type)
      formData.append('procedureNumber', procedureNumber)

      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      const uploadResult = await uploadResponse.json()
      if (!uploadResult.success || !uploadResult.objectKey) {
        throw new Error(uploadResult.error || 'Upload failed')
      }

      // Step 3: Attach to procedure
      const attachResponse = await fetch(
        `/api/verification/procedures/${encodeURIComponent(procedureNumber)}/documents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: document.type,
            objectKey: uploadResult.objectKey,
            fileName: uploadResult.filename || document.file.name,
            contentType: uploadResult.contentType,
            autoSubmit: true,
          }),
        },
      )

      const attachResult = await attachResponse.json()
      if (!attachResult.success) {
        throw new Error(attachResult.error || 'Failed to attach document to verification procedure')
      }

      // Step 4: Update procedure state and session
      if (attachResult.procedure) {
        setVerificationProcedure(attachResult.procedure)
      } else {
        // If backend didn't return updated, reload
        await loadVerificationProcedure()
      }

      await refreshSession()
      router.refresh()
    } catch (error) {
      console.error('KYC document upload error:', error)
      throw error
    }
  }

  // Render error screen if API/user load failed hard
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

  // Render empty screen if user not found (should only occur for hard logout/unauth)
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

  /**
   * Return badge color class for user role (for styling, not logic)
   */
  const getRoleBadgeColor = (role: UserRolesArray) => {
    switch (role) {
      case UserRolesArray.superadmin: return 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100'
      case UserRolesArray.admin: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case UserRolesArray.confidential: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case UserRolesArray.member: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case UserRolesArray.subscriber: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  /**
   * Format ISO/string/Date object as US long date – can be extended via locale
   */
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  /**
   * Localized navigation items for the Profile section (sidebar/rail + mobile)
   */
  const profileMenuItems = [
    { id: 'overview', label: t('overview'), icon: User },
    { id: 'communications', label: t('communications'), icon: MessageSquare },
    { id: 'professional', label: t('professional'), icon: Briefcase },
    { id: 'regional', label: t('regional'), icon: MapPin },
    { id: 'verification', label: t('verification'), icon: CheckCircle },
    { id: 'security', label: t('security'), icon: Shield },
  ]

  /**
   * Handler: Go to edit profile route.
   * next-intl useRouter expects unprefixed paths (locale applied by navigation helpers).
   */
  const handleEditProfile = () => {
    router.push('/profile/edit')
  }

  /**
   * Handler: Go to profile settings route
   */
  const handleNavigateSettings = () => {
    router.push('/settings')
  }

  /**
   * Handler: Initiate sign out (using auth context).
   * Auth.js redirectTo is a full browser URL — keep locale for non-default locales.
   */
  const handleSignOut = () => {
    signOut({
      redirect: true,
      redirectTo: ROUTES.LOGIN(locale),
    })
  }

  /**
   * Profile navigation rail component, pre-configured with menu, state, and handlers.
   */
  const profileRail = (
    <ProfileNavRail
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      profileMenuItems={profileMenuItems}
      onNavigate={() => setRightSidebarOpen(false)}
      onEditProfile={handleEditProfile}
      onNavigateSettings={handleNavigateSettings}
      onSignOut={handleSignOut}
      username={user.username || null}
    />
  )

  // --------- MAIN RENDER FUNCTION ------------

  return (
    <RingRightRailLayout
      flushCenterPane
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      rightRail={profileRail}
    >
      <DavinciCenterPane contentClassName="relative !px-3 !py-3 sm:!px-5 sm:!py-4 lg:!px-6 space-y-5 sm:space-y-6">
          {/* Role / status labels — top-right of center pane (wallet-style flush glass) */}
          <div className="pointer-events-none absolute right-0 top-0 z-[2] flex flex-col items-end gap-1.5 pr-0.5 pt-0.5 sm:pr-1 sm:pt-1">
            <Badge className={cn(getRoleBadgeColor(user.role as UserRolesArray), 'pointer-events-auto shadow-sm')}>
              {user.role}
            </Badge>
            {user.isVerified && (
              <Badge
                variant="default"
                className="pointer-events-auto bg-green-100 text-green-800 shadow-sm dark:bg-green-900 dark:text-green-200"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
            {((user as any)?.membership?.active || (user as any)?.subscription?.active) && (
              <Badge className="pointer-events-auto border-amber-400/30 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-sm">
                <Medal className="mr-1 h-3 w-3" />
                Member
              </Badge>
            )}
          </div>

          {/* Conditionally render a message banner if save encountered error/success */}
          {saveMessage && (
            <div className="mb-0 max-w-[calc(100%-7rem)]">
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

          {/* Profile hero — no nested BorderBeam; pane already carries davinciPanelSurface gradient */}
          <div className="pr-16 sm:pr-20">
            <div className="flex flex-col items-center gap-5 md:flex-row md:items-start">
              {/* Avatar Section */}
              <div className="flex shrink-0 flex-col items-center space-y-2">
                <Avatar
                  src={(user as { avatarThumb?: string | null }).avatarThumb || user.photoURL || session?.user?.image}
                  alt={user.name || 'User'}
                  size="2xl"
                  fallback={user.name?.charAt(0) || 'U'}
                  editable={true}
                  onUpload={handleAvatarUpload}
                  uploading={avatarUploading}
                  className="border-4 border-border"
                />
                {uploadError && (
                  <Alert variant="destructive" className="text-xs">
                    <AlertDescription className="text-xs">{uploadError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Profile main info */}
              <div className="w-full min-w-0 flex-1 space-y-3 text-center md:text-left">
                <h1 className="text-2xl font-bold md:text-3xl">{user.name || 'Anonymous User'}</h1>

                {/* Username */}
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  {user.username ? (
                    <>
                      <span className="font-mono text-sm text-muted-foreground">@{user.username}</span>
                      <button
                        type="button"
                        className="text-xs text-[var(--davinci-beam)] hover:underline"
                        onClick={() => setSetUsernameModalOpen(true)}
                      >
                        {t('changeUsername')}
                      </button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setSetUsernameModalOpen(true)}
                    >
                      <User className="h-3.5 w-3.5" />
                      {t('setUsername')}
                    </Button>
                  )}
                </div>

                {/* Bio editable */}
                <div>
                  {(user as any)?.bio ? (
                    <div className="flex items-start justify-center gap-2 md:justify-start">
                      <p className="max-w-lg text-sm text-muted-foreground">{(user as any).bio}</p>
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-xs text-[var(--davinci-beam)] hover:underline"
                        onClick={() => setBioEditModalOpen(true)}
                      >
                        {t('edit') || 'Edit'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-[var(--davinci-beam)] hover:underline"
                      onClick={() => setBioEditModalOpen(true)}
                    >
                      {t('addBio') || 'Add bio'}
                    </button>
                  )}
                </div>

                {/* Email/phone display */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground md:justify-start">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </span>
                  {(user as any)?.phoneNumber && (
                    <>
                      <span className="hidden text-muted-foreground/40 md:inline">|</span>
                      <span className="flex items-center gap-1">
                        {formatPhone((user as any).phoneNumber)}
                      </span>
                    </>
                  )}
                </div>

                {/* Organization/country */}
                <div className="flex flex-wrap justify-center gap-3 text-xs md:justify-start md:gap-4">
                  {(user as any)?.organization && (
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{(user as any).organization}</span>
                    </div>
                  )}
                  {(user as any)?.cultural?.country && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{(user as any).cultural.country}</span>
                    </div>
                  )}
                </div>

                {/* Credit + native balances */}
                {mounted ? <ProfileHeroBalances locale={locale.toLowerCase()} /> : null}
              </div>
            </div>
          </div>

          {/* Reward quests — expand for stacked reward-credit-add events */}
          {mounted && (
            <UserProgressWidget
              usernameSet={!!user.username}
              bioSet={!!((user as any)?.bio)}
              telegramSet={isTelegramLinked((user as any)?.communication)}
              kycApproved={kycStatus === KYCStatus.APPROVED}
              locale={locale.toLowerCase()}
              onNavigateTab={setActiveTab}
              onOpenUsernameModal={() => setSetUsernameModalOpen(true)}
              onOpenBioModal={() => setBioEditModalOpen(true)}
            />
          )}

          {/* Main Content Section: varies by activeTab. All logic below is conditional UI. */}
          {mounted && (
            <div className="space-y-6">

              {/* Mobile tab chrome — skip on overview (widgets speak for themselves) */}
              {activeTab !== 'overview' && (
                <div className="mb-4 lg:hidden">
                  <h2 className="flex items-center gap-2 text-2xl font-bold">
                    {profileMenuItems.find(item => item.id === activeTab)?.icon && (
                      <span className="inline-flex">
                        {React.createElement(profileMenuItems.find(item => item.id === activeTab)!.icon, { className: "w-6 h-6" })}
                      </span>
                    )}
                    {profileMenuItems.find(item => item.id === activeTab)?.label}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeTab === 'communications' && t('communicationsTabDescription')}
                    {activeTab === 'professional' && t('professionalTabDescription')}
                    {activeTab === 'security' && t('securityTabDescription')}
                  </p>
                </div>
              )}

              {/* ========== Conditional tab rendering ========== */}

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PersonalPageWidget
                      username={user?.username || null}
                      publicProfile={readPublicProfile(user)}
                      publicProfileSections={readPublicProfileSections(user)}
                      publicProfileFields={readPublicProfileFields(user)}
                      acceptProfileDms={readAcceptProfileDms(user)}
                      onOpenUsernameModal={() => setSetUsernameModalOpen(true)}
                      onPublicProfileChange={(enabled, sections, fields, acceptDms) => {
                        if (initialUser) {
                          ;(initialUser as AuthUser).publicProfile = enabled
                          ;(initialUser as AuthUser).publicProfileSections = sections
                          ;(initialUser as AuthUser).publicProfileFields = fields
                          ;(initialUser as AuthUser).acceptProfileDms = acceptDms
                        }
                      }}
                    />
                    <ShareEarnWidget
                      username={user?.username || null}
                      publicProfile={readPublicProfile(user)}
                    />
                  </div>
                </div>
              )}

              {/* Communications (Messengers) tab */}
              {activeTab === 'communications' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        {t('communications')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{t('communicationsDescription')}</p>
                      {/* Telegram — linked only when verified telegramId (UID) is present */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-full shrink-0">
                          <Send className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t('telegramAccount')}</p>
                          {isTelegramLinked((user as any)?.communication) ? (
                            <div className="text-xs text-muted-foreground truncate space-y-0.5">
                              <p className="font-medium text-foreground/80">
                                {formatTelegramProfileLabel((user as any).communication)}
                              </p>
                              <p className="font-mono opacity-70">
                                UID {(user as any).communication.telegramId}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t('telegramNotConnected')}</p>
                          )}
                        </div>
                        {isTelegramLinked((user as any)?.communication) ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={telegramUnlinking}
                              onClick={async () => {
                                if (
                                  typeof window !== 'undefined' &&
                                  !window.confirm(t('unlinkConfirm'))
                                ) {
                                  return
                                }
                                setTelegramUnlinking(true)
                                try {
                                  const { unlinkTelegramAccount } = await import(
                                    '@/app/_actions/profile'
                                  )
                                  const result = await unlinkTelegramAccount()
                                  if (result.success) {
                                    await updateSession()
                                    await refreshSession()
                                    router.refresh()
                                  } else {
                                    setUploadError(result.message || 'Unlink failed')
                                  }
                                } catch (err) {
                                  console.error('Telegram unlink error:', err)
                                  setUploadError('Failed to unlink Telegram')
                                } finally {
                                  setTelegramUnlinking(false)
                                }
                              }}
                            >
                              {telegramUnlinking ? t('unlinking') : t('unlinkTelegram')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => setTelegramLinking(true)}
                            >
                              {t('addTelegramAccount')}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            className="shrink-0"
                            onClick={() => setTelegramLinking(true)}
                          >
                            {t('addTelegramAccount')}
                          </Button>
                        )}
                      </div>
                      {/* WhatsApp */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 bg-green-50 dark:bg-green-950 rounded-full shrink-0">
                          <Phone className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t('whatsappAccount')}</p>
                          {/* STUB: Provide value, onChange, and server update on blur. */}
                          <Input
                            placeholder={t('inputPlaceholder', { platform: 'WhatsApp' }) || 'Enter your WhatsApp number'}
                            className="h-8 mt-1 text-sm"
                            defaultValue={(user as any)?.communication?.whatsappNumber || ''}
                          />
                        </div>
                      </div>
                      {/* Viber */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 bg-purple-50 dark:bg-purple-950 rounded-full shrink-0">
                          <Phone className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t('viberAccount')}</p>
                          {/* STUB: Implement value change and save logic */}
                          <Input
                            placeholder={t('inputPlaceholder', { platform: 'Viber' }) || 'Enter your Viber phone number'}
                            className="h-8 mt-1 text-sm"
                            defaultValue={(user as any)?.communication?.viberNumber || ''}
                          />
                        </div>
                      </div>
                      {/* Instagram */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 bg-pink-50 dark:bg-pink-950 rounded-full shrink-0">
                          <MessageSquare className="w-5 h-5 text-pink-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t('instagramAccount')}</p>
                          {/* STUB: Implement value change and save logic */}
                          <Input
                            placeholder={t('inputPlaceholder', { platform: 'Instagram' }) || 'Enter your Instagram username'}
                            className="h-8 mt-1 text-sm"
                            defaultValue={(user as any)?.communication?.instagramUsername || ''}
                          />
                        </div>
                      </div>
                      {/* Signal */}
                      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/30 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-full shrink-0">
                          <MessageSquare className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t('signalAccount')}</p>
                          {/* STUB: Implement value change and save logic */}
                          <Input
                            placeholder={t('inputPlaceholder', { platform: 'Signal' }) || 'Enter your Signal phone number'}
                            className="h-8 mt-1 text-sm"
                            defaultValue={(user as any)?.communication?.signalNumber || ''}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Professional tab */}
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
                      <p className="text-sm text-muted-foreground">{t('professionalDescription')}</p>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('organization')}</Label>
                          <p className="font-medium">{(user as any)?.organization || 'Not set'}</p>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('position')}</Label>
                          <p className="font-medium">{(user as any)?.position || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('professionalBio')}</Label>
                        <p className="text-sm text-muted-foreground">{(user as any)?.bio || 'No bio set'}</p>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">{t('socialMediaProfiles')}</h3>
                        <div className="grid gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-lg flex-shrink-0">
                              <span className="text-blue-600 font-bold text-sm">in</span>
                            </div>
                            <Input
                              readOnly
                              value={(user as any)?.integrations?.socialProfiles?.linkedin || 'Not set'}
                              className="bg-muted"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-sky-50 dark:bg-sky-950 rounded-lg flex-shrink-0">
                              <span className="text-sky-500 font-bold text-sm">𝕏</span>
                            </div>
                            <Input
                              readOnly
                              value={(user as any)?.integrations?.socialProfiles?.twitter || 'Not set'}
                              className="bg-muted"
                            />
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">{t('skillsExpertise')}</h3>
                        <div className="flex flex-wrap gap-2">
                          {((user as any)?.skills || []).length > 0 ? (
                            (user as any)?.skills.map((skill: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-sm py-1">{skill}</Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No skills added yet</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="flex justify-end">
                    {/* Settings navigation to full edit */}
                    <Button variant="outline" size="sm" onClick={() => handleNavigateSettings()}>
                      <Settings className="mr-2 h-4 w-4" />
                      Edit in Settings
                    </Button>
                  </div>
                </div>
              )}

              {/* Regional/location tab (country, timezone, map modal) */}
              {activeTab === 'regional' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {t('regional')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <p className="text-sm text-muted-foreground">{t('regionalDescription') || 'Manage your location and timezone settings'}</p>
                      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                        {/* Country/Location */}
                        <div className="space-y-3 p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-base">
                              <MapPin className="w-4 h-4 text-primary" />
                              <span>{t('country')}</span>
                            </Label>
                          </div>
                          <p className="font-medium">{(user as any)?.cultural?.country || 'Not set'}</p>
                          {(user as any)?.cultural?.address && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{(user as any)?.cultural?.address}</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocationModalOpen(true)}
                            className="w-full"
                          >
                            <MapPin className="w-3.5 h-3.5 mr-1" />
                            {t('selectLocation') || 'Select preferred location'}
                          </Button>
                        </div>
                        {/* Timezone select */}
                        <div className="space-y-3 p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-base">
                              <Globe className="w-4 h-4 text-primary" />
                              <span>{t('timezone')}</span>
                            </Label>
                          </div>
                          <p className="font-medium">{(user as any)?.cultural?.timezone || 'Not set'}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTimezoneModalOpen(true)}
                            className="w-full"
                          >
                            <Globe className="w-3.5 h-3.5 mr-1" />
                            {t('selectTimezone') || 'Select my timezone'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* KYC Verification Tab */}
              {activeTab === 'verification' && (
                <div className="space-y-6">
                  <KYCUpload
                    onUpload={handleKYCDocumentUpload}
                    currentStatus={mapProcedureStatusToKyc(verificationProcedure?.status)}
                    uploadedDocuments={(verificationProcedure?.documents ?? []).map((doc) => ({
                      type: doc.documentType as KYCDocumentType,
                      status: mapProcedureStatusToKyc(
                        doc.status === 'accepted' ? 'approved' : verificationProcedure?.status,
                      ),
                      uploadedAt: new Date(doc.uploadedAt),
                      fileName: doc.fileName,
                    }))}
                  />
                </div>
              )}

              {/* Security Tab: security basics, sessions, download data */}
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
                        <SessionForensicsWidget
                          entries={forensicsEntries}
                          loading={forensicsLoading}
                          lastLogin={(user as any).lastLogin ? formatDate((user as any).lastLogin) : undefined}
                        />
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="text-base md:text-lg font-semibold">{t('accountSecurity')}</h3>
                        {/* Security actions – TODO: Implement actions with server actions (Next 15+) */}
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
      </DavinciCenterPane>

      {/* Modal: Bio Editor */}
      <BioEditModal
        open={bioEditModalOpen}
        onOpenChange={setBioEditModalOpen}
        currentBio={(user as any)?.bio || ''}
        onBioSaved={(newBio) => {
          if (initialUser) {
            ;(initialUser as AuthUser).bio = newBio
          }
        }}
      />

      {/* Modal: Set Username */}
      <SetUsernameModal
        open={setUsernameModalOpen}
        onOpenChange={setSetUsernameModalOpen}
        currentUsername={user?.username || ''}
        currentPublicProfile={readPublicProfile(user)}
        onUsernameSaved={(newUsername, newPublicProfile) => {
          if (initialUser) {
            ;(initialUser as AuthUser).username = newUsername
            ;(initialUser as AuthUser).publicProfile = newPublicProfile
          }
        }}
      />

      {/* Modal: Timezone Select */}
      <TimezoneSelectorModal
        open={timezoneModalOpen}
        onOpenChange={setTimezoneModalOpen}
        currentTimezone={(user as any)?.cultural?.timezone || ''}
        currentCountryCode={(user as any)?.cultural?.country || undefined}
        onTimezoneSaved={(newTimezone) => {
          if (user) {
            if (!(user as any).cultural) (user as any).cultural = {}
            ;(user as any).cultural.timezone = newTimezone
            // TODO: Sync and persist to backend (server action/React 19)
          }
        }}
      />

      {/* Modal: Telegram auth/linking */}
      <TelegramLinkingModal
        open={telegramLinking}
        onOpenChange={setTelegramLinking}
        // STUB: Pass server-side logic for successful auth linking, update comms on save
      />

      {/* Modal: Location via map */}
      <LocationMapModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        currentLocation={
          (user as any)?.cultural?.address
            ? {
                address: (user as any).cultural.address,
                lat: parseFloat((user as any).cultural.latitude || '50.4501'),
                lng: parseFloat((user as any).cultural.longitude || '30.5234'),
              }
            : null
        }
        onLocationSaved={(newLocation) => {
          if (user) {
            if (!(user as any).cultural) (user as any).cultural = {}
            ;(user as any).cultural.address = newLocation.address
            ;(user as any).cultural.latitude = String(newLocation.lat)
            ;(user as any).cultural.longitude = String(newLocation.lng)
            // TODO: Save to backend via server action optimistically (React 19)
          }
        }}
      />

    </RingRightRailLayout>
  )
}