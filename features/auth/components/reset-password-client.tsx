'use client'

import { useEffect, useState, useActionState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  completePasswordReset,
  type AuthEmailActionState,
} from '@/app/_actions/auth-email-actions'

const initial: AuthEmailActionState = { ok: false, message: '', step: 'email' }

export default function ResetPasswordClient() {
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale
  const [token, setToken] = useState('')
  const [state, action, pending] = useActionState(completePasswordReset, initial)

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    const params = new URLSearchParams(raw)
    setToken(params.get('token') || '')
  }, [])

  return (
    <div className="mx-auto max-w-md w-full px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">{tAuth('reset.title')}</h1>
        <p className="text-sm text-muted-foreground">{tAuth('reset.description')}</p>
      </div>
      {state.message && (
        <Alert variant={state.ok ? 'default' : 'destructive'}>
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      )}
      {!state.ok && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={tAuth('reset.passwordPlaceholder')}
            className="h-12"
            disabled={pending || !token}
          />
          <Input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={tAuth('reset.confirmPlaceholder')}
            className="h-12"
            disabled={pending || !token}
          />
          <Button
            type="submit"
            disabled={pending || !token}
            className="w-full h-12 bg-green-500 hover:bg-green-600 text-white"
          >
            {pending ? tAuth('signIn.loading') : tAuth('reset.submit')}
          </Button>
        </form>
      )}
      <Button variant="outline" className="w-full" asChild>
        <a href={ROUTES.LOGIN(locale)}>{tAuth('status.actions.backToLogin')}</a>
      </Button>
    </div>
  )
}
