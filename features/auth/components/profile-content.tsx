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
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'
import { UserRole } from '@/features/auth/types'
import { 
  User, 
  Mail, 
  Wallet, 
  Shield, 
  Calendar, 
  Edit2, 
  Save,
  AlertCircle
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
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  
  const [state, formAction] = useActionState(updateProfile, {
    success: false,
    message: ''
  })

  // Use initial user if available (has full AuthUser data), otherwise use session user
  const user = initialUser || session?.user

  useEffect(() => {
    if (state?.success) {
      setIsEditing(false)
      // Optionally refresh the page to get updated data
      router.refresh()
    }
  }, [state?.success, router])

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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar 
                src={user.photoURL} 
                alt={user.name || 'User'} 
                size="lg"
                fallback={user.name?.charAt(0) || 'U'}
              />
              <div>
                <CardTitle className="text-2xl">{t('profile')}</CardTitle>
                <CardDescription>
                  {isEditing ? 'Edit your profile information' : 'View and manage your account'}
                </CardDescription>
              </div>
            </div>
            {!isEditing && (
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {state?.message && (
            <Alert variant={state.success ? "default" : "destructive"}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          {isEditing ? (
            <form action={formAction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={user.name || ''}
                    placeholder="Enter your name"
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
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={user.username || ''}
                    placeholder="Choose a username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="pt-2">
                    <Badge className={getRoleBadgeColor(user.role as UserRole)}>
                      {user.role}
                    </Badge>
                  </div>
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
          ) : (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{user.name || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Username</p>
                    <p className="font-medium">{user.username || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('role')}</p>
                    <Badge className={getRoleBadgeColor(user.role as UserRole)}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
                {'bio' in user && (user as any).bio && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Bio</p>
                    <p className="mt-1">{(user as any).bio}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Account Details */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Account Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('memberSince')}</p>
                    <p className="font-medium">{formatDate('createdAt' in user ? (user as any).createdAt : null)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Login</p>
                    <p className="font-medium">{formatDate('lastLogin' in user ? (user as any).lastLogin : null)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('primaryAuthMethod')}</p>
                    <p className="font-medium capitalize">{'authProvider' in user ? (user as any).authProvider || 'Email' : 'provider' in user ? (user as any).provider || 'Email' : 'Email'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('verificationLevel')}</p>
                    <Badge variant={user.isVerified ? "default" : "secondary"}>
                      {user.isVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Wallet Information */}
              {user.wallets && user.wallets.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Wallet className="mr-2 h-5 w-5" />
                      Wallet Information
                    </h3>
                    <div className="space-y-3">
                      {user.wallets.map((wallet, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {wallet.label || `Wallet ${index + 1}`}
                              </p>
                              <p className="font-mono text-sm">{wallet.address}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Balance</p>
                              <p className="font-medium">{wallet.balance || '0'} ETH</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline"
                  onClick={() => router.push('/settings')}
                >
                  Settings
                </Button>
                {user.role === UserRole.SUBSCRIBER && (
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/membership')}
                  >
                    Upgrade Membership
                  </Button>
                )}
                {!user.isVerified && (
                  <Button 
                    variant="outline"
                    onClick={() => router.push('/verify')}
                  >
                    {t('getVerified')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
