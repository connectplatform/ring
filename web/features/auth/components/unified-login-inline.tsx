'use client'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import { Apple, Diamond } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import GoogleSignInButtonGIS from './google-signin-button-gis'
import TelegramSignInButton from './telegram-signin-button'
import { EmailLoginForm } from './email-login-form'

const DEFAULT_LOCALE = 'en' as const

declare global {
  interface Window {
    ethereum?: unknown
  }
}

interface UnifiedLoginInlineProps {
  from?: string
  variant?: 'default' | 'hero'
  locale?: Locale
  initialAuthError?: string
}

function mapAuthJsError(code: string | undefined, tAuth: (key: string) => string): string | null {
  if (!code) return null
  const key = `errors.${code}` as const
  try {
    const msg = tAuth(key)
    if (msg && msg !== key) return msg
  } catch {
    /* fall through */
  }
  return code.replace(/_/g, ' ')
}

const UnifiedLoginInline: React.FC<UnifiedLoginInlineProps> = ({
  from,
  variant = 'default',
  locale,
  initialAuthError,
}) => {
  const tAuth = useTranslations('modules.auth')
  const router = useRouter()
  const [error, setError] = useState<string | null>(() => mapAuthJsError(initialAuthError, tAuth))
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthInProgress, setIsAuthInProgress] = useState(false)

  const handleSignIn = useCallback(
    async (provider: string) => {
      try {
        const activeLocale = (locale ?? DEFAULT_LOCALE) as Locale
        const callbackUrl = buildOAuthCallbackUrl(from, activeLocale)
        await signIn(provider, { callbackUrl })
      } catch (err) {
        console.error(`${provider} sign-in error:`, err)
        setError(`Failed to sign in with ${provider}`)
      }
    },
    [from, locale],
  )

  const handleCryptoLogin = useCallback(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    const query = params.toString()
    const path = ROUTES.WALLET_CONNECT(locale)
    router.push(query ? `${path}?${query}` : path)
  }, [from, locale, router])

  const socialBlock = (compact: boolean) => (
    <>
      <GoogleSignInButtonGIS
        redirectUrl={from}
        className="w-full"
        variant="outline"
        size={compact ? 'default' : 'lg'}
        onAuthStart={() => {
          setIsLoading(true)
          setIsAuthInProgress(true)
        }}
        onAuthEnd={() => {
          setIsLoading(false)
          setIsAuthInProgress(false)
        }}
      />
      <TelegramSignInButton
        redirectUrl={from}
        className="w-full"
        variant="outline"
        size={compact ? 'default' : 'lg'}
        disabled={isLoading}
        onAuthStart={() => {
          setIsLoading(true)
          setIsAuthInProgress(true)
        }}
        onAuthEnd={() => {
          setIsLoading(false)
          setIsAuthInProgress(false)
        }}
      />
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
        <Button
          onClick={() => handleSignIn('apple')}
          disabled={isLoading}
          variant="outline"
          className={compact ? 'h-10 text-xs font-medium' : 'h-12 text-sm font-medium'}
        >
          <Apple className={compact ? 'mr-1 h-4 w-4' : 'mr-2 h-5 w-5'} />
          {tAuth('signIn.providers.apple')}
        </Button>
        <Button
          onClick={handleCryptoLogin}
          disabled={isLoading}
          variant="outline"
          className={compact ? 'h-10 text-xs font-medium' : 'h-12 text-sm font-medium'}
        >
          <Diamond className={compact ? 'mr-1 h-4 w-4' : 'mr-2 h-5 w-5'} />
          {tAuth('signIn.providers.metamask')}
        </Button>
      </div>
      <p className="text-[11px] text-center text-muted-foreground px-1">
        {tAuth('signIn.telegramPrivacy')}
      </p>
    </>
  )

  const terms = (
    <p className={`text-xs text-center text-muted-foreground ${variant === 'hero' ? 'mt-6' : 'mt-4'}`}>
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
  )

  return (
    <div className={variant === 'hero' ? 'w-full max-w-md mx-auto' : 'w-full'}>
      {isAuthInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-lg font-medium">{tAuth('signIn.loading')}</p>
          </div>
        </div>
      )}

      <div className={variant === 'hero' ? 'space-y-4' : 'space-y-3'}>
        {socialBlock(variant !== 'hero')}

        <div className={`relative ${variant === 'hero' ? 'my-6' : 'my-4'}`}>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">OR</span>
          </div>
        </div>

        <EmailLoginForm
          from={from}
          locale={locale}
          compact={variant !== 'hero'}
          onError={(msg) => setError(msg)}
        />

        {terms}
      </div>

      {error && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        </div>
      )}
    </div>
  )
}

export default UnifiedLoginInline
