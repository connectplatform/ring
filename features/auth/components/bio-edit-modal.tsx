'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FsModal } from '@/components/ui/fs-modal'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface BioEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBio: string
  onBioSaved?: (newBio: string) => void
}

/**
 * Bio Edit — DaVinci FsModal.
 * Mobile: no visible title; description → textarea → Save fit remaining viewport (keyboard-safe).
 */
export default function BioEditModal({
  open,
  onOpenChange,
  currentBio,
  onBioSaved,
}: BioEditModalProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const [bio, setBio] = useState(currentBio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBio(currentBio)
      setError(null)
      setSaving(false)
    }
  }, [open, currentBio])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('bio', bio)
      const { updateProfile } = await import('@/app/_actions/profile')
      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        await updateSession()
        onBioSaved?.(bio)
        onOpenChange(false)
      } else {
        setError(result.message || 'Failed to save bio')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('editBio') || 'Edit Bio'}
      description={t('editBioDescription') || 'Update your professional bio or personal description'}
      hideTitleOnMobile
      hideHeaderSeparator
      className="sm:h-auto sm:max-h-[90dvh]"
      contentClassName={cn(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden !py-3',
        // Mobile: fill space under keyboard with flex textarea
        'max-sm:!flex max-sm:min-h-0',
      )}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="max-sm:hidden sm:inline-flex"
          >
            {t('cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? t('saving') || 'Saving...' : t('save') || 'Save'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="shrink-0 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={t('tellUsAboutYourself') || 'Tell us about yourself...'}
        autoFocus
        className={cn(
          'resize-none',
          // Desktop: comfortable fixed area
          'min-h-[200px] sm:min-h-[220px]',
          // Mobile: grow into remaining viewport under description / above Save
          'max-sm:min-h-0 max-sm:flex-1',
        )}
      />
      <p className="shrink-0 text-right text-xs text-muted-foreground">
        {bio.length} characters
      </p>
    </FsModal>
  )
}
