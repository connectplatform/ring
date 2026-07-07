'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { Loader2, Lock, CheckCircle, XCircle } from 'lucide-react'

interface SetUsernameModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUsername: string
  currentPublicProfile: boolean
  onUsernameSaved?: (username: string, publicProfile: boolean) => void
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

/**
 * Set/Change Username Modal
 * - Enter desired username with inline check availability
 * - Public/Private personal page toggle
 * - Browser address bar preview when public
 * - Save + Discard bottom buttons
 */
export default function SetUsernameModal({
  open,
  onOpenChange,
  currentUsername,
  currentPublicProfile,
  onUsernameSaved,
}: SetUsernameModalProps) {
  const t = useTranslations('modules.profile')
  const locale = useLocale()
  const { update: updateSession } = useSession()
  const router = useRouter()

  const [username, setUsername] = useState(currentUsername || '')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [publicProfile, setPublicProfile] = useState(currentPublicProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setUsername(currentUsername || '')
      setUsernameStatus('idle')
      setUsernameError(null)
      setPublicProfile(currentPublicProfile)
      setSaving(false)
      setError(null)
    }
  }, [open, currentUsername, currentPublicProfile])

  // Site URL for preview
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const validateUsername = (val: string): string | null => {
    if (!val || val.length < 3) return t('usernameMinLength')
    if (!/^[a-zA-Z0-9_-]+$/.test(val)) return t('usernameInvalidChars')
    return null
  }

  const handleCheck = async () => {
    const validationError = validateUsername(username)
    if (validationError) {
      setUsernameError(validationError)
      setUsernameStatus('error')
      return
    }

    setUsernameStatus('checking')
    setUsernameError(null)

    try {
      const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
      const result = await response.json()

      if (result.available) {
        setUsernameStatus('available')
        setUsernameError(null)
      } else {
        setUsernameStatus('taken')
        setUsernameError(result.error || t('usernameTaken'))
      }
    } catch {
      setUsernameStatus('error')
      setUsernameError(t('usernameCheckFailed'))
    }
  }

  const handleSave = async (closeAfterSave: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('username', username)
      // Store publicProfile in the JSONB user data
      formData.append('publicProfile', publicProfile ? 'true' : 'false')

      const { updateProfile } = await import('@/app/_actions/profile')
      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        await updateSession()
        router.refresh()
        onUsernameSaved?.(username, publicProfile)
        if (closeAfterSave) {
          onOpenChange(false)
        } else {
          setUsernameStatus('idle')
        }
      } else {
        setError(result.message || 'Failed to save username')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setUsername(currentUsername || '')
    setUsernameStatus('idle')
    setUsernameError(null)
    setPublicProfile(currentPublicProfile)
    setError(null)
    onOpenChange(false)
  }

  const hasChanges =
    username !== currentUsername ||
    publicProfile !== currentPublicProfile

  const isChecking = usernameStatus === 'checking'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-sm:min-h-screen max-sm:rounded-none max-sm:pt-12">
        <DialogHeader>
          <DialogTitle>
            {currentUsername ? t('changeUsername') || 'Change username' : t('chooseUsername') || 'Choose a unique username'}
          </DialogTitle>
          <DialogDescription>
            {t('usernameHint') || '3-32 characters, letters, numbers, underscores, and hyphens. Public profile: /en/yourname'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Username Input Row */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="username-input">{t('username') || 'Username'}</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="username-input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (usernameStatus !== 'idle') {
                    setUsernameStatus('idle')
                    setUsernameError(null)
                  }
                }}
                placeholder="@username"
                className="flex-1"
                disabled={isChecking}
                autoFocus
              />

              {/* Check button (idle) */}
              {usernameStatus === 'idle' && (
                <Button
                  size="sm"
                  onClick={handleCheck}
                  disabled={!username || username.length < 3}
                >
                  {t('checkUsername') || 'Check'}
                </Button>
              )}

              {/* Spinner (checking) */}
              {isChecking && (
                <Button size="sm" disabled>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </Button>
              )}

              {/* Save + Cancel (available) */}
              {usernameStatus === 'available' && (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save') || 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUsername(currentUsername || '')
                      setUsernameStatus('idle')
                      setUsernameError(null)
                    }}
                    disabled={saving}
                  >
                    {t('cancel') || 'Cancel'}
                  </Button>
                </div>
              )}

              {/* Error state shows Check again */}
              {(usernameStatus === 'taken' || usernameStatus === 'error') && (
                <Button
                  size="sm"
                  onClick={handleCheck}
                  disabled={!username || username.length < 3}
                >
                  {t('checkUsername') || 'Check'}
                </Button>
              )}
            </div>

            {/* Status messages */}
            {usernameStatus === 'available' && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {t('usernameAvailable') || 'Username available'}
              </p>
            )}
            {usernameStatus === 'taken' && usernameError && (
              <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                <XCircle className="w-3.5 h-3.5" />
                {usernameError}
              </p>
            )}
            {usernameStatus === 'error' && usernameError && (
              <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                <XCircle className="w-3.5 h-3.5" />
                {usernameError}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t pt-4" />

          {/* Personal Page Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="public-profile-toggle" className="text-base font-medium cursor-pointer">
                {t('personalPage') || 'Personal page'}
              </Label>
              <Switch
                id="public-profile-toggle"
                checked={publicProfile}
                onCheckedChange={setPublicProfile}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {publicProfile
                ? (t('personalPagePublic') || 'Your profile page is visible to everyone')
                : (t('personalPagePrivate') || 'Your profile page is hidden')
              }
            </p>

            {/* Browser address bar preview when public */}
            {publicProfile && username && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm">
                  {/* Mock browser chrome dots */}
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  {/* Address bar */}
                  <div className="flex-1 flex items-center gap-1.5 bg-background rounded px-2 py-1 border text-xs font-mono text-muted-foreground truncate">
                    <Lock className="w-3 h-3 text-green-600 shrink-0" />
                    <span className="truncate">
                      {siteUrl.replace(/^https?:\/\//, '')}/{locale}/{username}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state when no username */}
            {publicProfile && !username && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 bg-background rounded px-2 py-1 border text-xs font-mono opacity-50">
                    {t('setUsernameFirst') || 'Set a username first'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={saving}
          >
            {t('discard') || 'Discard'}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />{t('saving') || 'Saving...'}</>
            ) : (
              t('saveChanges') || 'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
