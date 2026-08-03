'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Avatar } from '@/components/ui/avatar'
import { Loader2, User, Mail, Sparkles, Wallet, CheckCircle, Gift } from 'lucide-react'
import {
  completeVitalsOnboarding,
  type VitalsOnboardingFormState,
} from '@/app/_actions/vitals-onboarding'
import { ROUTES } from '@/constants/routes'
import { shortenAddress } from '@/features/evm/utils'

export type VitalsRewardHint = {
  event: string
  amount: string
  label: string
}

export type VitalsOnboardingFormProps = {
  creditBalanceUnitLabel: string
  rewardHints: VitalsRewardHint[]
  onComplete?: () => Promise<void> | void
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="min-w-[9rem] shadow-sm h-12 text-base">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          …
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}

function OnboardingBrief({
  isWallet,
  creditBalanceUnitLabel,
}: {
  isWallet: boolean
  creditBalanceUnitLabel: string
}) {
  const t = useTranslations('modules.auth.onboarding')
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex items-start gap-4 rounded-2xl border border-border/50 bg-gradient-to-br from-primary/5 via-background/80 to-background p-6 backdrop-blur-sm lg:p-8"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/75 shadow-md">
        {isWallet ? (
          <Wallet className="h-7 w-7 text-primary-foreground" />
        ) : (
          <User className="h-7 w-7 text-primary-foreground" />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent lg:text-2xl">
          {isWallet ? t('titleWallet') : t('titleEmail')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
          {isWallet
            ? t('leadWallet', { unit: creditBalanceUnitLabel })
            : t('leadEmail', { unit: creditBalanceUnitLabel })}
        </p>
      </div>
    </motion.div>
  )
}

export default function VitalsOnboardingForm({
  creditBalanceUnitLabel,
  rewardHints,
  onComplete,
}: VitalsOnboardingFormProps) {
  const { data: session, update } = useSession()
  const locale = useLocale() as Locale
  const t = useTranslations('modules.auth.onboarding')
  const isWallet = session?.user?.provider === 'crypto-wallet'
  const emailLocked = Boolean(session?.user?.email) && !isWallet

  const initialPhoto =
    (session?.user as { photoURL?: string } | undefined)?.photoURL ||
    session?.user?.image ||
    ''
  const [photoURL, setPhotoURL] = React.useState(initialPhoto)
  const [avatarUploading, setAvatarUploading] = React.useState(false)
  const [avatarError, setAvatarError] = React.useState<string | null>(null)

  const [state, formAction] = useActionState<VitalsOnboardingFormState | null, FormData>(
    (prev, formData) => completeVitalsOnboarding(prev, formData, locale),
    null,
  )

  React.useEffect(() => {
    if (!state?.success) return
    void (async () => {
      if (update) {
        await update({ needsOnboarding: false })
      }
      await onComplete?.()
    })()
  }, [state?.success, update, onComplete])

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true)
    setAvatarError(null)
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
      if (!result.success) {
        setAvatarError(result.error || t('fields.avatarUploadFailed'))
        return
      }
      const url = (result.url as string | undefined) || ''
      const thumb =
        (result.derivatives?.sync_thumb as string | undefined) ||
        (result.derivatives?.thumb as string | undefined) ||
        url
      setPhotoURL(url || thumb)
      if (update) {
        await update({
          photoURL: url || thumb,
          image: thumb || url,
          avatarThumb: thumb,
        })
      }
    } catch (error) {
      console.error('Onboarding avatar upload error:', error)
      setAvatarError(t('fields.avatarUploadFailed'))
    } finally {
      setAvatarUploading(false)
    }
  }

  if (!session?.user?.id) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('authRequired')}</AlertTitle>
        <AlertDescription>
          <Link href={ROUTES.LOGIN(locale)} className="underline">
            {t('backToLogin')}
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <OnboardingBrief isWallet={isWallet} creditBalanceUnitLabel={creditBalanceUnitLabel} />

      {state?.success && (
        <Alert className="mb-6 border-green-200 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-100 dark:border-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>{t('successTitle')}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state?.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">{t('fields.name')}</Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              defaultValue={session.user.name || ''}
              placeholder={t('fields.namePlaceholder')}
              className="pl-10 h-12"
              aria-invalid={!!state?.fieldErrors?.name}
            />
          </div>
          {state?.fieldErrors?.name && (
            <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('fields.email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required={!emailLocked}
              readOnly={emailLocked}
              defaultValue={session.user.email || ''}
              placeholder={t('fields.emailPlaceholder')}
              className={`pl-10 h-12 ${emailLocked ? 'bg-muted/50' : ''}`}
              aria-invalid={!!state?.fieldErrors?.email}
            />
          </div>
          {emailLocked && (
            <p className="text-xs text-muted-foreground">{t('fields.emailVerified')}</p>
          )}
          {state?.fieldErrors?.email && (
            <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label>{t('fields.avatar')}</Label>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Avatar
              src={photoURL || null}
              alt={session.user.name || 'User'}
              size="xl"
              fallback={session.user.name?.charAt(0) || 'U'}
              editable
              showCamera
              showUpload
              enableCrop
              onUpload={handleAvatarUpload}
              uploading={avatarUploading}
              cropTitle={t('fields.avatarCropTitle')}
              cropConfirmLabel={t('fields.avatarCropConfirm')}
              cropCancelLabel={t('fields.avatarCropCancel')}
              className="border-4 border-border"
            />
            <input type="hidden" name="photoURL" value={photoURL} />
            {avatarError ? (
              <p className="text-sm text-destructive">{avatarError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('fields.avatarHint')}</p>
            )}
          </div>
        </div>

        {isWallet && (
          <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0" />
            <span>
              {t('walletLinked')}{' '}
              <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                {session.user.id?.startsWith('0x')
                  ? shortenAddress(session.user.id)
                  : `${session.user.id?.slice(0, 6)}…${session.user.id?.slice(-4)}`}
              </code>
            </span>
          </div>
        )}

        {rewardHints.length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gift className="h-4 w-4 text-primary" />
              {t('rewardsTitle', { unit: creditBalanceUnitLabel })}
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {rewardHints.map((h) => (
                <li key={h.event}>
                  +{h.amount} {creditBalanceUnitLabel} — {h.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <SubmitButton label={t('submit')} />
        </div>
      </form>
    </div>
  )
}
