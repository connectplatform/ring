'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ProfileContentProps } from '@/types/profile'
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
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'
import { UserRole, KYCStatus, KYCLevel, KYCDocumentType } from '@/features/auth/types'
import { useAuth } from '@/hooks/use-auth'
import { useSession } from 'next-auth/react'
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
  Target
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
  const t = useTranslations('modules.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { getKycStatus, refreshSession } = useAuth()
  const { update: updateSession } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  // Use initial user if available (has full AuthUser data), otherwise use session user
  const user = initialUser || session?.user
  const kycStatus = getKycStatus()

  const [usernameMode, setUsernameMode] = useState<'view' | 'edit' | 'checking'>('view')
  const [usernameValue, setUsernameValue] = useState(user?.username || '')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  
  const [state, formAction] = useActionState(updateProfile, {
    success: false,
    message: ''
  })

  useEffect(() => {
    if (state?.success) {
      setIsEditing(false)
      router.refresh()
    }
  }, [state?.success, router])

  useEffect(() => {
    setUsernameValue(user?.username || '')
  }, [user?.username])

  useEffect(() => {
    setMounted(true)
  }, [])

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
        // Update user photo and refresh session
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
        // TODO: Update KYC documents in backend
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
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
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
      case UserRole.ADMIN: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case UserRole.CONFIDENTIAL: return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case UserRole.MEMBER: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case UserRole.SUBSCRIBER: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getStatusBadge = (status: KYCStatus) => {
    const statusConfig = {
      [KYCStatus.NOT_STARTED]: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Not Started' },
      [KYCStatus.PENDING]: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      [KYCStatus.UNDER_REVIEW]: { color: 'bg-blue-100 text-blue-800', icon: Eye, label: 'Under Review' },
      [KYCStatus.APPROVED]: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      [KYCStatus.REJECTED]: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      [KYCStatus.EXPIRED]: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Expired' }
    }

    const config = statusConfig[status]
    return (
      <Badge className={config.color}>
        <config.icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const getLevelProgress = (level: KYCLevel) => {
    const levels = [KYCLevel.NONE, KYCLevel.BASIC, KYCLevel.STANDARD, KYCLevel.ENHANCED]
    return (levels.indexOf(level) + 1) * 25
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-3">
              <Avatar 
                src={user.photoURL} 
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
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{user.name || 'Anonymous User'}</h1>
                  <Badge className={getRoleBadgeColor(user.role as UserRole)}>
                    {user.role}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{user.email}</p>
                {(user as any)?.bio && (
                  <p className="text-sm mt-2 max-w-md">{(user as any).bio}</p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Joined {formatDate('createdAt' in user ? (user as any).createdAt : null)}</span>
                </div>
                {user.isVerified && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Verified Account</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button 
                    onClick={() => setIsEditing(true)}
                    size="sm"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    {t('editProfile')}
                  </Button>
                ) : (
                  <Button 
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/settings')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Profile Content Tabs */}
      {mounted ? (
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="space-y-6"
          defaultValue="overview"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="verification">{t('verification')}</TabsTrigger>
            <TabsTrigger value="wallet">{t('wallet')}</TabsTrigger>
            <TabsTrigger value="activity">{t('activity')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {state?.message && (
              <Alert variant={state.success ? "default" : "destructive"}>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            {isEditing ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('editProfile')}</CardTitle>
                  <CardDescription>Update your profile information</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={formAction} className="space-y-6">
                    {/* Hidden userId field for server action */}
                    <input type="hidden" name="userId" value={user.id} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          defaultValue={user.name || ''}
                          placeholder="Enter your full name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          name="username"
                          defaultValue={user.username || ''}
                          placeholder="Choose a username"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          defaultValue={user.email}
                          disabled
                          className="bg-muted"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          defaultValue={(user as any)?.phoneNumber || ''}
                          placeholder="Enter your phone number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="organization">Organization</Label>
                        <Input
                          id="organization"
                          name="organization"
                          defaultValue={(user as any)?.organization || ''}
                          placeholder="Your company or organization"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="position">Position</Label>
                        <Input
                          id="position"
                          name="position"
                          defaultValue={(user as any)?.position || ''}
                          placeholder="Your job title or position"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        name="bio"
                        defaultValue={'bio' in user ? (user as any).bio || '' : ''}
                        placeholder="Tell us about yourself"
                        rows={4}
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <SubmitButton />
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('personalInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{user.name || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Username</p>
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
                                      const response = await fetch('/api/profile', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username: usernameValue })
                                      })
                                      
                                                                          if (response.ok) {
                                      // Update the user object with the new username
                                      if (user) {
                                        (user as any).username = usernameValue
                                      }
                                      
                                      setUsernameMode('view')
                                      setUsernameAvailable(null)
                                      setUsernameError(null)
                                      
                                      // Trigger session update to fetch fresh user data from Firebase
                                      await updateSession()
                                      await refreshSession()
                                      router.refresh()
                                    } else {
                                        const error = await response.json()
                                        setUsernameError(error.error || 'Failed to save username')
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
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{(user as any)?.phoneNumber || 'Not set'}</p>
                    </div>
                    {(user as any)?.organization && (
                      <div>
                        <p className="text-sm text-muted-foreground">Organization</p>
                        <p className="font-medium">{(user as any).organization}</p>
                      </div>
                    )}
                    {(user as any)?.position && (
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{(user as any).position}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Account Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {t('accountInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('memberSince')}</p>
                      <p className="font-medium">{formatDate('createdAt' in user ? (user as any).createdAt : null)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Login</p>
                      <p className="font-medium">{formatDate('lastLogin' in user ? (user as any).lastLogin : null)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Auth Method</p>
                      <p className="font-medium capitalize">{'authProvider' in user ? (user as any).authProvider || 'Email' : 'Email'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Status</p>
                      <Badge variant={user.isVerified ? "default" : "secondary"}>
                        {user.isVerified ? 'Verified' : 'Unverified'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Verification Tab */}
          <TabsContent value="verification" className="space-y-6">
            <KYCVerificationSection 
              user={user}
              kycStatus={kycStatus}
              onDocumentUpload={handleKYCDocumentUpload}
              onStatusRefresh={() => {
                refreshSession()
                router.refresh()
              }}
            />
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <WalletSection user={user} />
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivitySection user={user} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-6">
          {/* Loading fallback that matches server render structure */}
          <div className="h-10 bg-muted animate-pulse rounded-md"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded-md"></div>
            <div className="h-32 bg-muted animate-pulse rounded-md"></div>
          </div>
        </div>
      )}
    </div>
  )
}

// Supporting Components

function KYCVerificationSection({ 
  user, 
  kycStatus, 
  onDocumentUpload, 
  onStatusRefresh 
}: {
  user: any
  kycStatus: string | null
  onDocumentUpload: (document: { type: KYCDocumentType; file: File }) => Promise<void>
  onStatusRefresh: () => void
}) {
  const t = useTranslations('modules.profile.kyc')
  const [uploading, setUploading] = useState<KYCDocumentType | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      not_started: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Not Started' },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      under_review: { color: 'bg-blue-100 text-blue-800', icon: Eye, label: 'Under Review' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      expired: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Expired' }
    }

    const config = statusConfig[status] || statusConfig.not_started
    return (
      <Badge className={config.color}>
        <config.icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const handleFileUpload = async (type: KYCDocumentType, file: File) => {
    setUploadError(null)
    setUploading(type)

    try {
      await onDocumentUpload({ type, file })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const requiredDocuments = [
    { type: KYCDocumentType.PASSPORT, label: 'Passport', required: true },
    { type: KYCDocumentType.ID_CARD, label: 'National ID Card', required: false },
    { type: KYCDocumentType.UTILITY_BILL, label: 'Utility Bill', required: true },
    { type: KYCDocumentType.BANK_STATEMENT, label: 'Bank Statement', required: false }
  ]

  const kycVerification = user.kycVerification
  const currentLevel = kycVerification?.level || KYCLevel.NONE
  const documents = kycVerification?.documents || []

  return (
    <div className="space-y-6">
      {/* KYC Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                KYC Verification
              </CardTitle>
              <CardDescription>
                Verify your identity to access enhanced features
              </CardDescription>
            </div>
            {getStatusBadge(kycStatus || 'not_started')}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Verification Level Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Verification Level</span>
              <span className="font-medium">{currentLevel.toUpperCase()}</span>
            </div>
            <Progress 
              value={((Object.values(KYCLevel).indexOf(currentLevel) + 1) / Object.values(KYCLevel).length) * 100} 
              className="h-2" 
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>None</span>
              <span>Basic</span>
              <span>Standard</span>
              <span>Enhanced</span>
            </div>
          </div>

          {/* Status Information */}
          {kycVerification && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {kycVerification.submittedAt 
                    ? new Date(kycVerification.submittedAt).toLocaleDateString()
                    : 'Not submitted'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="font-medium">
                  {kycVerification.verifiedAt 
                    ? new Date(kycVerification.verifiedAt).toLocaleDateString()
                    : 'Pending'
                  }
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Required Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {requiredDocuments.map(({ type, label, required }) => {
              const existingDoc = documents.find((d: any) => d.type === type)
              const isUploading = uploading === type

              return (
                <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        {required ? 'Required' : 'Optional'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {existingDoc ? (
                      <>
                        {getStatusBadge(existingDoc.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(existingDoc.fileUrl, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          id={`upload-${type}`}
                          className="hidden"
                          accept="image/*,application/pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(type, file)
                            }
                          }}
                          disabled={isUploading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-${type}`)?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <div className="w-4 h-4 mr-2 animate-spin border-2 border-current border-t-transparent rounded-full" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Requirements:</strong> Max 10MB per file. 
              Accepted formats: JPG, PNG, PDF, DOC, DOCX.
              Documents should be clear, unedited, and show all required information.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onStatusRefresh}>
              <Shield className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WalletSection({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Wallet Information
          </CardTitle>
          <CardDescription>
            View and manage your crypto wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.wallets && user.wallets.length > 0 ? (
            <div className="space-y-4">
              {user.wallets.map((wallet: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={wallet.isDefault ? "default" : "secondary"}>
                        {wallet.isDefault ? 'Default' : 'Additional'}
                      </Badge>
                      {wallet.label && <span className="text-sm text-muted-foreground">{wallet.label}</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{wallet.balance || '0'} ETH</p>
                      <p className="text-sm text-muted-foreground">Balance</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-mono text-sm break-all">{wallet.address}</p>
                  </div>
                  {wallet.createdAt && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(wallet.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No wallets connected</p>
              <Button>
                Connect Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActivitySection({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      {/* Opportunities Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{user.postedopportunities?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Posted</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold">{user.savedopportunities?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Saved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Badge variant={user.notificationPreferences?.email ? "default" : "secondary"}>
                {user.notificationPreferences?.email ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">In-App Notifications</p>
                <p className="text-sm text-muted-foreground">Show notifications in the app</p>
              </div>
              <Badge variant={user.notificationPreferences?.inApp ? "default" : "secondary"}>
                {user.notificationPreferences?.inApp ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">SMS Notifications</p>
                <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
              </div>
              <Badge variant={user.notificationPreferences?.sms ? "default" : "secondary"}>
                {user.notificationPreferences?.sms ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
