'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

/**
 * Magic-link landing — reads #token= from hash (never consumes on GET).
 * User confirms → signIn('email-magic') consumes token server-side.
 */
export default function VerifyClient() {
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    const params = new URLSearchParams(raw)
    const t = params.get('token')
    setToken(t)
    if (!t) setError(tAuth('errors.Verification'))
  }, [tAuth])

  const onConfirm = () => {
    if (!token) return
    setError(null)
    startTransition(async () => {
      const callbackUrl = ROUTES.PROFILE(locale)
      const onboardingUrl = `${ROUTES.LOGIN_ONBOARDING(locale)}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      const result = await signIn('email-magic', {
        token,
        redirect: false,
        callbackUrl,
      })
      if (result?.error) {
        setError(tAuth('errors.Verification'))
        return
      }
      // Clear hash so refresh cannot replay
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      const sess = await getSession()
      router.replace(sess?.user?.needsOnboarding ? onboardingUrl : callbackUrl)
    })
  }

  return (
    <div className="mx-auto max-w-md w-full px-4 py-16 text-center space-y-6">
      <h1 className="text-2xl font-semibold">{tAuth('verify.title')}</h1>
      <p className="text-muted-foreground text-sm">{tAuth('verify.description')}</p>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <Button
        onClick={onConfirm}
        disabled={!token || pending}
        className="w-full h-12 bg-green-500 hover:bg-green-600 text-white"
      >
        {pending ? tAuth('signIn.loading') : tAuth('verify.confirm')}
      </Button>
      <Button variant="outline" className="w-full" asChild>
        <a href={ROUTES.LOGIN(locale)}>{tAuth('status.actions.backToLogin')}</a>
      </Button>
    </div>
  )
}
