'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'

interface BioEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBio: string
  onBioSaved?: (newBio: string) => void
}

/**
 * Bio Edit Modal
 * - Mobile: fullscreen dialog
 * - Desktop/iPad: convenient-size centered dialog
 * Saves bio via updateProfile server action.
 */
export default function BioEditModal({
  open,
  onOpenChange,
  currentBio,
  onBioSaved,
}: BioEditModalProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const router = useRouter()
  const [bio, setBio] = useState(currentBio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        router.refresh()
        onBioSaved?.(bio)
        onOpenChange(false)
      } else {
        setError(result.message || 'Failed to save bio')
      }
    } catch (e) {
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-sm:min-h-screen max-sm:rounded-none max-sm:pt-12">
        <DialogHeader>
          <DialogTitle>{t('editBio') || 'Edit Bio'}</DialogTitle>
          <DialogDescription>
            {t('editBioDescription') || 'Update your professional bio or personal description'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="py-4">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            placeholder={t('tellUsAboutYourself') || 'Tell us about yourself...'}
            className="resize-none min-h-[200px]"
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground text-right">
            {bio.length} characters
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
