'use client'

import { useActionState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  requestPasswordReset,
  type AuthEmailActionState,
} from '@/app/_actions/auth-email-actions'

const initial: AuthEmailActionState = { ok: false, message: '', step: 'email' }

export default function ForgotPasswordClient() {
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale
  const [state, action, pending] = useActionState(requestPasswordReset, initial)

  return (
    <div className="mx-auto max-w-md w-full px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">{tAuth('forgot.title')}</h1>
        <p className="text-sm text-muted-foreground">{tAuth('forgot.description')}</p>
      </div>
      {state.message && (
        <Alert variant={state.ok ? 'default' : 'destructive'}>
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      )}
      {state.step !== 'sent' && (
        <form action={action} className="space-y-4">
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={tAuth('signIn.emailPlaceholder')}
            className="h-12"
            disabled={pending}
          />
          <Button
            type="submit"
            disabled={pending}
            className="w-full h-12 bg-green-500 hover:bg-green-600 text-white"
          >
            {pending ? tAuth('signIn.loading') : tAuth('forgot.submit')}
          </Button>
        </form>
      )}
      <Button variant="outline" className="w-full" asChild>
        <a href={ROUTES.LOGIN(locale)}>{tAuth('status.actions.backToLogin')}</a>
      </Button>
    </div>
  )
}
