'use client'

import React, { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  requestLoginCode,
  requestMagicLink,
  type AuthEmailActionState,
} from '@/app/_actions/auth-email-actions'

type Step = 'email' | 'otp' | 'link-sent'

type EmailLoginFormProps = {
  from?: string
  locale?: Locale
  compact?: boolean
  onError?: (message: string) => void
}

/**
 * Ring Mailer email auth — OTP primary, magic link secondary.
 */
export function EmailLoginForm({
  from,
  locale,
  compact = false,
  onError,
}: EmailLoginFormProps) {
  const tAuth = useTranslations('modules.auth')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('email')
  const [info, setInfo] = useState<string | null>(null)

  const callbackUrl = from || ROUTES.PROFILE(locale)
  const onboardingUrl = (() => {
    const qs = new URLSearchParams()
    qs.set('callbackUrl', callbackUrl)
    return `${ROUTES.LOGIN_ONBOARDING(locale || 'en')}?${qs.toString()}`
  })()

  const routeAfterEmailAuth = useCallback(async () => {
    const sess = await getSession()
    if (sess?.user?.needsOnboarding) {
      router.replace(onboardingUrl)
      return
    }
    router.replace(callbackUrl)
  }, [callbackUrl, onboardingUrl, router])

  const fail = useCallback(
    (msg: string) => {
      onError?.(msg)
    },
    [onError],
  )

  const onRequestCode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const fd = new FormData(e.currentTarget)
      startTransition(async () => {
        const state: AuthEmailActionState = await requestLoginCode(null, fd)
        if (!state.ok) {
          fail(state.message)
          return
        }
        setEmail(state.email || String(fd.get('email') || ''))
        setStep('otp')
        setInfo(state.message)
      })
    },
    [fail],
  )

  const onVerifyCode = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      startTransition(async () => {
        const result = await signIn('email-otp', {
          email: email.trim(),
          code: code.trim(),
          redirect: false,
          callbackUrl,
        })
        if (result?.error) {
          fail(tAuth('errors.Verification'))
          return
        }
        await routeAfterEmailAuth()
      })
    },
    [email, code, callbackUrl, fail, routeAfterEmailAuth, tAuth],
  )

  const onRequestLink = useCallback(() => {
    const fd = new FormData()
    fd.set('email', email || '')
    startTransition(async () => {
      if (!email.trim()) {
        fail(tAuth('errors.emailRequired'))
        return
      }
      const state = await requestMagicLink(null, fd)
      if (!state.ok) {
        fail(state.message)
        return
      }
      setStep('link-sent')
      setInfo(state.message)
    })
  }, [email, fail, tAuth])

  const inputH = compact ? 'h-10 text-sm' : 'h-12 text-base'
  const btnH = compact ? 'h-10 text-sm' : 'h-12'

  if (step === 'link-sent') {
    return (
      <div className="text-center py-4 space-y-3">
        <Mail className={`mx-auto ${compact ? 'h-10 w-10' : 'h-12 w-12'} text-green-500`} />
        <h3 className={`font-semibold ${compact ? 'text-base' : 'text-lg'}`}>
          {tAuth('signIn.magicLink.sent')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
        </p>
        <Button
          variant="outline"
          className="w-full"
          size={compact ? 'sm' : 'default'}
          onClick={() => {
            setStep('email')
            setCode('')
            setInfo(null)
          }}
        >
          {tAuth('signIn.magicLink.useDifferent')}
        </Button>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <form onSubmit={onVerifyCode} className="space-y-3" noValidate>
        {info && <p className="text-xs text-muted-foreground text-center">{info}</p>}
        <p className="text-sm text-center text-muted-foreground">
          {tAuth('signIn.otp.sentTo')} <strong>{email}</strong>
        </p>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          name="code"
          placeholder={tAuth('signIn.otp.placeholder')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={pending}
          className={`w-full ${inputH} tracking-[0.4em] text-center font-semibold`}
          required
          maxLength={6}
        />
        <Button
          type="submit"
          disabled={pending || code.length !== 6}
          className={`w-full ${btnH} bg-green-500 hover:bg-green-600 text-white font-medium`}
        >
          {pending ? tAuth('signIn.loading') : tAuth('signIn.otp.verify')}
        </Button>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRequestLink}>
            {tAuth('signIn.otp.emailLinkInstead')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              setStep('email')
              setCode('')
              setInfo(null)
            }}
          >
            {tAuth('signIn.magicLink.useDifferent')}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={onRequestCode} className="space-y-3" noValidate>
      <div className="relative">
        <Input
          type="email"
          placeholder={tAuth('signIn.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className={`w-full ${inputH} pl-4 pr-10`}
          required
          autoComplete="email"
          name="email"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Mail className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground`} />
        </div>
      </div>
      <Button
        type="submit"
        disabled={pending || !email.trim()}
        className={`w-full ${btnH} bg-green-500 hover:bg-green-600 text-white font-medium`}
      >
        {pending ? tAuth('signIn.loading') : tAuth('signIn.providers.email')}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        <a href={ROUTES.FORGOT_PASSWORD(locale)} className="text-blue-600 hover:underline">
          {tAuth('signIn.forgotPassword')}
        </a>
      </p>
    </form>
  )
}
