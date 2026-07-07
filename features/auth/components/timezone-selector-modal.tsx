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
import TimezoneSelect from '@/components/ui/timezone-select'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { useRouter } from '@/i18n/routing'
import { Loader2, Globe } from 'lucide-react'

interface TimezoneSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTimezone: string
  currentCountryCode?: string
  onTimezoneSaved?: (timezone: string) => void
}

/**
 * Timezone Selector Modal
 * Reuses SetUsernameModal pattern with the existing TimezoneSelect component.
 * - Fullscreen mobile, centered dialog desktop
 * - Searchable timezone dropdown with current time display
 * - Auto-detect from locale as fallback
 */
export default function TimezoneSelectorModal({
  open,
  onOpenChange,
  currentTimezone,
  currentCountryCode,
  onTimezoneSaved,
}: TimezoneSelectorModalProps) {
  const t = useTranslations('modules.profile')
  const { update: updateSession } = useSession()
  const router = useRouter()

  const [timezone, setTimezone] = useState(currentTimezone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTimezone(currentTimezone || detectTimezone())
      setSaving(false)
      setError(null)
    }
  }, [open, currentTimezone])

  // Auto-detect timezone from browser
  const detectTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kiev'
    } catch {
      return 'Europe/Kiev'
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      // Store timezone inside cultural JSONB
      const cultural = {
        timezone: timezone,
      }
      formData.append('cultural', JSON.stringify(cultural))

      const { updateProfile } = await import('@/app/_actions/profile')
      const result = await updateProfile({ success: false, message: '' }, formData)
      if (result.success) {
        await updateSession()
        router.refresh()
        onTimezoneSaved?.(timezone)
        onOpenChange(false)
      } else {
        setError(result.message || 'Failed to save timezone')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDetect = () => {
    const detected = detectTimezone()
    setTimezone(detected)
  }

  const hasChanges = timezone !== currentTimezone

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-sm:min-h-screen max-sm:rounded-none max-sm:pt-12">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('selectTimezone') || 'Select my timezone'}
          </DialogTitle>
          <DialogDescription>
            {t('chooseTimezone') || 'Choose your preferred timezone for scheduling and notifications'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="py-4 space-y-4">
          <TimezoneSelect
            value={timezone}
            onChange={setTimezone}
            countryCode={currentCountryCode}
            placeholder={t('selectTimezone') || 'Select timezone...'}
          />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t('currentTimezone') || 'Current'}: <span className="font-mono font-medium">{detectTimezone()}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDetect}
              className="text-xs h-7"
            >
              {t('autoDetect') || 'Auto-detect'}
            </Button>
          </div>
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
            disabled={!timezone || !hasChanges || saving}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />{t('saving') || 'Saving...'}</>
            ) : (
              t('save') || 'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
