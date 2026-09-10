'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { useSession } from 'next-auth/react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import GoogleSignInButtonGIS from './google-signin-button-gis'
import TelegramSignInButton from './telegram-signin-button'
import { EmailLoginForm } from './email-login-form'

interface UnifiedLoginComponentProps {
  open: boolean
  onClose?: () => void
  from?: string
  isAuthenticating?: boolean
}

const UnifiedLoginComponent: React.FC<UnifiedLoginComponentProps> = ({
  open,
  onClose,
  from,
  isAuthenticating = false,
}) => {
  const tAuth = useTranslations('modules.auth')
  const router = useRouter()
  const { status } = useSession()
  const locale = useLocale() as Locale
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(locale))
      onClose?.()
    }
  }, [status, router, from, onClose, open, locale])

  return (
    <Dialog open={open} onOpenChange={onClose || (() => {})}>
      <DialogContent className="sm:max-w-[425px] p-8">
        <DialogHeader className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <img src="/logo.svg" alt="Ring Logo" className="w-16 h-16" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">{tAuth('signIn.title')}</DialogTitle>
          <p className="text-muted-foreground mt-2 text-center">{tAuth('signIn.subtitle')}</p>
        </DialogHeader>

        <div className="space-y-4">
          <GoogleSignInButtonGIS
            redirectUrl={from || ROUTES.PROFILE(locale)}
            className="w-full"
            variant="outline"
            size="lg"
            disabled={isAuthenticating}
            onAuthStart={() => setIsLoading(true)}
            onAuthEnd={() => setIsLoading(false)}
          />

          <TelegramSignInButton
            redirectUrl={from || ROUTES.PROFILE(locale)}
            className="w-full"
            variant="outline"
            size="lg"
            disabled={isLoading || isAuthenticating}
            onAuthStart={() => setIsLoading(true)}
            onAuthEnd={() => setIsLoading(false)}
          />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-muted-foreground">OR</span>
            </div>
          </div>

          <EmailLoginForm
            from={from}
            locale={locale}
            onError={(msg) => setError(msg)}
          />

          <p className="text-xs text-center text-muted-foreground mt-6">
            {tAuth('signIn.disclaimerPrefix')}{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              {tAuth('signIn.termsOfUse')}
            </a>{' '}
            {tAuth('signIn.and')}{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              {tAuth('signIn.privacyPolicy')}
            </a>
            .
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UnifiedLoginComponent
