'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { confirmPhoneOtp, startPhoneOtp } from '@/app/_actions/phone-otp'

interface PhoneOtpPanelProps {
  initialPhone?: string | null
  phoneVerifiedAt?: string | null
}

export function PhoneOtpPanel({ initialPhone, phoneVerifiedAt }: PhoneOtpPanelProps) {
  const t = useTranslations('modules.auth.phoneOtp')
  const [phone, setPhone] = useState(initialPhone || '')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [verifiedAt, setVerifiedAt] = useState<string | null>(phoneVerifiedAt || null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const verified = Boolean(verifiedAt)

  const handleSend = () => {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const result = await startPhoneOtp(phone)
      if (!result.success) {
        setError(result.error)
        return
      }
      setPhone(result.phone)
      setVerifiedAt(null) // challenge started — prior verification no longer applies to this attempt
      setStep('code')
      setMessage(t('codeSent'))
    })
  }

  const handleConfirm = () => {
    startTransition(async () => {
      setError(null)
      setMessage(null)
      const result = await confirmPhoneOtp(code)
      if (!result.success) {
        setError(result.error)
        return
      }
      setVerifiedAt(result.phoneVerifiedAt)
      setPhone(result.phone)
      setMessage(t('verified'))
      setStep('phone')
      setCode('')
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {verified ? (
          <Badge variant="outline" className="border-green-600 text-green-700">
            {t('verifiedBadge')}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-600 text-amber-700">
            {t('unverifiedBadge')}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('subtitle')}</p>

      <div className="space-y-2">
        <Label htmlFor="phone-otp">{t('phoneLabel')}</Label>
        <Input
          id="phone-otp"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+380…"
          disabled={isPending}
        />
      </div>

      {step === 'code' && (
        <div className="space-y-2">
          <Label htmlFor="phone-otp-code">{t('codeLabel')}</Label>
          <Input
            id="phone-otp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••"
            inputMode="numeric"
            disabled={isPending}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleSend} disabled={isPending || !phone.trim()}>
          {t('sendCode')}
        </Button>
        {step === 'code' && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleConfirm}
            disabled={isPending || code.trim().length < 4}
          >
            {t('confirmCode')}
          </Button>
        )}
      </div>
    </div>
  )
}
