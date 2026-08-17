'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  requestLoginCode,
  requestMagicLink,
  type AuthEmailActionState,
} from '@/app/_actions/auth-email-actions'
import {
  requestPhoneLoginCode,
  type AuthPhoneActionState,
} from '@/app/_actions/auth-phone-actions'
import {
  whatsAppRailAvailableClient,
  readWhatsappOptOut,
  writeWhatsappOptOut,
} from '@/features/auth/lib/phone-login-client'

type Step = 'identifier' | 'otp' | 'link-sent'
type AuthMode = 'email' | 'phone'

type EmailLoginFormProps = {
  from?: string
  locale?: Locale
  compact?: boolean
  onError?: (message: string) => void
}

function looksLikeEmail(value: string): boolean {
  return value.includes('@')
}

/**
 * Unified Email or Phone passwordless login — OTP primary, magic link for email only.
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
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('identifier')
  const [mode, setMode] = useState<AuthMode>('email')
  const [info, setInfo] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [channelUsed, setChannelUsed] = useState<'telegram' | 'whatsapp' | 'email' | null>(
    null,
  )
  const [whatsappOptOut, setWhatsappOptOut] = useState(false)
  useEffect(() => {
    setWhatsappOptOut(readWhatsappOptOut())
  }, [])
  const showWhatsAppOptOut =
    mode === 'phone' && step === 'identifier' && whatsAppRailAvailableClient()

  const callbackUrl = from || ROUTES.PROFILE(locale)
  const onboardingUrl = (() => {
    const qs = new URLSearchParams()
    qs.set('callbackUrl', callbackUrl)
    return `${ROUTES.LOGIN_ONBOARDING(locale || 'en')}?${qs.toString()}`
  })()

  const routeAfterAuth = async () => {
    const sess = await getSession()
    if (sess?.user?.needsOnboarding) {
      router.replace(onboardingUrl)
      return
    }
    router.replace(callbackUrl)
  }

  const fail = (msg: string) => {
    onError?.(msg)
  }

  const onRequestCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const raw = identifier.trim()
    if (!raw) {
      fail(tAuth('errors.emailRequired'))
      return
    }

    startTransition(async () => {
      if (looksLikeEmail(raw)) {
        const fd = new FormData()
        fd.set('email', raw)
        const state: AuthEmailActionState = await requestLoginCode(null, fd)
        if (!state.ok) {
          fail(state.message)
          return
        }
        setMode('email')
        setIdentifier(state.email || raw)
        setChannelUsed('email')
        setChallengeId(null)
        setStep('otp')
        setInfo(state.message)
        return
      }

      const fd = new FormData()
      fd.set('phone', raw)
      if (whatsappOptOut) fd.set('whatsappOptOut', '1')
      const state: AuthPhoneActionState = await requestPhoneLoginCode(null, fd)
      if (!state.ok) {
        fail(state.message)
        return
      }
      setMode('phone')
      setIdentifier(state.phone || raw)
      setChallengeId(state.challengeId || null)
      setChannelUsed(state.channelUsed || 'telegram')
      setStep('otp')
      setInfo(state.message)
    })
  }

  const onVerifyCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      if (mode === 'phone') {
        if (!challengeId) {
          fail(tAuth('errors.Verification'))
          return
        }
        const result = await signIn('phone-otp', {
          phone: identifier.trim(),
          code: code.trim(),
          challengeId,
          redirect: false,
          callbackUrl,
        })
        if (result?.error) {
          fail(tAuth('errors.Verification'))
          return
        }
        await routeAfterAuth()
        return
      }

      const result = await signIn('email-otp', {
        email: identifier.trim(),
        code: code.trim(),
        redirect: false,
        callbackUrl,
      })
      if (result?.error) {
        fail(tAuth('errors.Verification'))
        return
      }
      await routeAfterAuth()
    })
  }

  const onRequestLink = () => {
    if (mode !== 'email') return
    const fd = new FormData()
    fd.set('email', identifier || '')
    startTransition(async () => {
      if (!identifier.trim()) {
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
  }

  const resetIdentifier = () => {
    setStep('identifier')
    setCode('')
    setInfo(null)
    setChallengeId(null)
    setChannelUsed(null)
  }

  const inputH = compact ? 'h-10 text-sm' : 'h-12 text-base'
  const btnH = compact ? 'h-10 text-sm' : 'h-12'
  const IdentifierIcon = looksLikeEmail(identifier) || mode === 'email' ? Mail : Phone

  if (step === 'link-sent') {
    return (
      <div className="text-center py-4 space-y-3">
        <Mail className={`mx-auto ${compact ? 'h-10 w-10' : 'h-12 w-12'} text-green-500`} />
        <h3 className={`font-semibold ${compact ? 'text-base' : 'text-lg'}`}>
          {tAuth('signIn.magicLink.sent')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {tAuth('signIn.magicLink.sentDescription')} <strong>{identifier}</strong>
        </p>
        <Button
          variant="outline"
          className="w-full"
          size={compact ? 'sm' : 'default'}
          onClick={resetIdentifier}
        >
          {tAuth('signIn.magicLink.useDifferent')}
        </Button>
      </div>
    )
  }

  if (step === 'otp') {
    const channelLabel =
      channelUsed === 'telegram'
        ? tAuth('signIn.otp.channelTelegram')
        : channelUsed === 'whatsapp'
          ? tAuth('signIn.otp.channelWhatsApp')
          : tAuth('signIn.otp.channelEmail')

    return (
      <form onSubmit={onVerifyCode} className="space-y-3" noValidate>
        {info && <p className="text-xs text-muted-foreground text-center">{info}</p>}
        {channelUsed && (
          <p className="text-xs text-center text-muted-foreground">{channelLabel}</p>
        )}
        <p className="text-sm text-center text-muted-foreground">
          {tAuth('signIn.otp.sentTo')} <strong>{identifier}</strong>
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
          {mode === 'email' && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRequestLink}>
              {tAuth('signIn.otp.emailLinkInstead')}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={resetIdentifier}>
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
          type="text"
          placeholder={tAuth('signIn.emailOrPhonePlaceholder')}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            setMode(looksLikeEmail(e.target.value) ? 'email' : 'phone')
          }}
          disabled={pending}
          className={`w-full ${inputH} pl-4 pr-10`}
          required
          autoComplete="username"
          name="identifier"
          inputMode={looksLikeEmail(identifier) ? 'email' : 'tel'}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <IdentifierIcon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground`} />
        </div>
      </div>
      {showWhatsAppOptOut && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={whatsappOptOut}
            onChange={(e) => {
              const next = e.target.checked
              setWhatsappOptOut(next)
              writeWhatsappOptOut(next)
            }}
            disabled={pending}
          />
          <span>{tAuth('signIn.whatsappOptOut')}</span>
        </label>
      )}
      <Button
        type="submit"
        disabled={pending || !identifier.trim()}
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
