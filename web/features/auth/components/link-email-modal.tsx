'use client'

import React, { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FsModal } from '@/components/ui/fs-modal'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { CheckCircle, Loader2, Mail } from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  confirmLinkEmail,
  requestLinkEmailCode,
  type LinkEmailActionState,
} from '@/app/_actions/auth-link-email-actions'

interface LinkEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Link Email FsModal — mirror Telegram linking choreography.
 * Reuses Ring Mailer OTP; never mails virtual addresses.
 */
export default function LinkEmailModal({ open, onOpenChange }: LinkEmailModalProps) {
  const t = useTranslations('modules.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setCode('')
    setStep('email')
    setMessage(null)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (step === 'done') {
        void updateSession()
        router.refresh()
      }
      reset()
      onOpenChange(false)
    } else {
      onOpenChange(true)
    }
  }

  const onSendCode = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const fd = new FormData()
      fd.set('email', email.trim())
      const state: LinkEmailActionState = await requestLinkEmailCode(null, fd)
      if (!state.ok) {
        setError(state.message)
        return
      }
      setEmail(state.email || email.trim())
      setStep('otp')
      setMessage(state.message)
    })
  }

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setError(null)
      const fd = new FormData()
      fd.set('email', email.trim())
      fd.set('code', code.trim())
      const state = await confirmLinkEmail(null, fd)
      if (!state.ok) {
        setError(state.message)
        return
      }
      setStep('done')
      setMessage(state.message)
      await updateSession()
      router.refresh()
    })
  }

  return (
    <FsModal
      open={open}
      onOpenChange={handleOpenChange}
      title={t('linkEmailTitle')}
      hideHeaderSeparator
      className="max-sm:pt-0"
      contentClassName="flex flex-col p-0 sm:px-0"
    >
      <div className="relative mx-auto flex w-full min-h-[min(56dvh,420px)] flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
        {step === 'done' ? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-green-600">{t('linkEmailSuccess')}</p>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {email}
            </p>
            <Button onClick={() => handleOpenChange(false)} className="mt-2 w-full max-w-sm">
              {tCommon('actions.continue')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Mail className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {t('linkEmailSubtitle')}
            </p>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            {message && step === 'otp' && (
              <p className="text-xs text-muted-foreground text-center">{message}</p>
            )}

            {step === 'email' ? (
              <form onSubmit={onSendCode} className="w-full max-w-sm space-y-3">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t('linkEmailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  required
                />
                <Button type="submit" className="w-full" disabled={pending || !email.trim()}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('linkEmailSendCode')
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={onVerify} className="w-full max-w-sm space-y-3">
                <p className="text-center text-sm text-muted-foreground">
                  <strong>{email}</strong>
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={pending}
                  className="tracking-[0.4em] text-center font-semibold"
                  maxLength={6}
                  required
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || code.length !== 6}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('linkEmailVerify')
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={pending}
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setError(null)
                  }}
                >
                  {t('linkEmailChangeAddress')}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </FsModal>
  )
}
