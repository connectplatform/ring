'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FsModal } from '@/components/ui/fs-modal'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Loader2, Lock, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetUsernameModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUsername: string
  currentPublicProfile: boolean
  onUsernameSaved?: (username: string, publicProfile: boolean) => void
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

/**
 * Set/Change username (nickname) — DaVinci FsModal.
 * Mobile: hide title to save vertical space; URL preview has no locale prefix.
 */
export default function SetUsernameModal({
  open,
  onOpenChange,
  currentUsername,
  currentPublicProfile,
  onUsernameSaved,
}: SetUsernameModalProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()

  const [username, setUsername] = useState(currentUsername || '')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [publicProfile, setPublicProfile] = useState(currentPublicProfile)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  /** Public profile URL without locale prepend (global SSOT in this widget). */
  const publicPagePreview = username
    ? `${siteUrl.replace(/^https?:\/\//, '')}/${username}`
    : ''

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
      const response = await fetch(
        `/api/auth/check-username?username=${encodeURIComponent(username)}`,
      )
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
      formData.append('publicProfile', publicProfile ? 'true' : 'false')

      const { updateProfile } = await import('@/app/_actions/profile')
      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        await updateSession()
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
    username !== currentUsername || publicProfile !== currentPublicProfile

  const isChecking = usernameStatus === 'checking'
  const modalTitle = currentUsername
    ? t('editNickname') || t('changeUsername') || 'Edit nickname'
    : t('chooseUsername') || 'Choose a unique username'

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={t('usernameHint')}
      hideTitleOnMobile
      hideHeaderSeparator
      className="sm:h-auto sm:max-h-[90dvh]"
      contentClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto !py-3"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={saving}
            className="max-sm:order-2 sm:order-1"
          >
            {t('discard') || 'Discard'}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={!hasChanges || saving}
            className="w-full max-sm:order-1 sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {t('saving') || 'Saving...'}
              </>
            ) : (
              t('saveChanges') || 'Save Changes'
            )}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="shrink-0 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="username-input">{t('username') || 'Username'}</Label>
          <div className="mt-1 flex gap-2">
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

            {usernameStatus === 'idle' && (
              <Button
                size="sm"
                onClick={handleCheck}
                disabled={!username || username.length < 3}
              >
                {t('checkUsername') || 'Check'}
              </Button>
            )}

            {isChecking && (
              <Button size="sm" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            )}

            {usernameStatus === 'available' && (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('save') || 'Save'
                  )}
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

          {usernameStatus === 'available' && (
            <p className="mt-1 flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              {t('usernameAvailable') || 'Username available'}
            </p>
          )}
          {(usernameStatus === 'taken' || usernameStatus === 'error') && usernameError && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
              <XCircle className="h-3.5 w-3.5" />
              {usernameError}
            </p>
          )}
        </div>

        <div className="border-t pt-3" />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="public-profile-toggle"
              className="cursor-pointer text-base font-medium"
            >
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
              ? t('personalPagePublic') || 'Your profile page is visible to everyone'
              : t('personalPagePrivate') || 'Your profile page is hidden'}
          </p>

          {publicProfile && username ? (
            <div className="rounded-lg border border-[color-mix(in_oklch,var(--davinci-glass-border)_80%,transparent)] bg-[color-mix(in_oklch,var(--davinci-glass-bg)_70%,transparent)] p-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex gap-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                </div>
                <div
                  className={cn(
                    'flex flex-1 items-center gap-1.5 truncate rounded border bg-background px-2 py-1 font-mono text-xs text-muted-foreground',
                  )}
                >
                  <Lock className="h-3 w-3 shrink-0 text-green-600" />
                  <span className="truncate">{publicPagePreview}</span>
                </div>
              </div>
            </div>
          ) : null}

          {publicProfile && !username ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              {t('setUsernameFirst') || 'Set a username first'}
            </div>
          ) : null}
        </div>
      </div>
    </FsModal>
  )
}
