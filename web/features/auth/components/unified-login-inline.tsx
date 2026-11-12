'use client'

import React, { useState } from 'react'
import type { Locale } from '@/i18n/shared'
import { useTranslations } from 'next-intl'
import { Alert, AlertTitle } from '@/components/ui/alert'
import GoogleSignInButtonGIS from './google-signin-button-gis'
import TelegramSignInButton from './telegram-signin-button'
import { EmailLoginForm } from './email-login-form'

interface UnifiedLoginInlineProps {
  from?: string
  variant?: 'default' | 'hero' | 'sheet'
  locale?: Locale
  initialAuthError?: string
  /** Close hosting modal before OAuth / wallet redirect. */
  onAuthAction?: () => void
}

const AUTH_ERROR_FALLBACK: Record<string, string> = {
  Configuration: 'Sign-in was interrupted or the auth session expired. Please try again.',
  OAuthCallback: 'Google sign-in did not complete. If you pressed Back during login, start again here.',
  OAuthSignin: 'Could not start Google sign-in. Please try again.',
  Callback: 'Sign-in callback failed. Please try again.',
  AccessDenied: 'Access denied.',
  Verification: 'The verification link expired or was already used.',
  Default: 'Sign-in could not be completed. Please try again.',
}

function mapAuthJsError(code: string | undefined, tAuth: (key: string) => string): string | null {
  if (!code) return null
  const key = `errors.${code}`
  try {
    const msg = tAuth(key)
    const unresolved =
      !msg ||
      msg === key ||
      msg.endsWith(`.${key}`) ||
      msg.endsWith(`.errors.${code}`)
    if (!unresolved) return msg
  } catch {
    /* fall through */
  }
  return AUTH_ERROR_FALLBACK[code] || code.replace(/_/g, ' ')
}

const UnifiedLoginInline: React.FC<UnifiedLoginInlineProps> = ({
  from,
  variant = 'default',
  locale,
  initialAuthError,
  onAuthAction,
}) => {
  const tAuth = useTranslations('modules.auth')
  const [error, setError] = useState<string | null>(() => mapAuthJsError(initialAuthError, tAuth))
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthInProgress, setIsAuthInProgress] = useState(false)

  const sheet = variant === 'sheet'
  const socialBlock = (compact: boolean) => (
    <>
      <GoogleSignInButtonGIS
        redirectUrl={from}
        className={sheet ? 'w-full whitespace-nowrap' : 'w-full'}
        variant="outline"
        size={compact ? 'default' : 'lg'}
        onAuthStart={() => {
          setIsLoading(true)
          setIsAuthInProgress(true)
          window.setTimeout(() => onAuthAction?.(), 80)
        }}
        onAuthEnd={() => {
          setIsLoading(false)
          setIsAuthInProgress(false)
        }}
      />
      <TelegramSignInButton
        redirectUrl={from}
        className={sheet ? 'w-full whitespace-nowrap' : 'w-full'}
        variant="outline"
        size={compact ? 'default' : 'lg'}
        disabled={isLoading}
        onAuthStart={() => {
          setIsLoading(true)
          setIsAuthInProgress(true)
          window.setTimeout(() => onAuthAction?.(), 80)
        }}
        onAuthEnd={() => {
          setIsLoading(false)
          setIsAuthInProgress(false)
        }}
      />
    </>
  )

  const fitRow = sheet ? 'w-0 min-w-full' : ''
  const terms = (
    <p className={`text-xs text-center text-muted-foreground ${fitRow} ${variant === 'hero' ? 'mt-6' : 'mt-3'}`}>
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
    <div className={variant === 'hero' ? 'w-full max-w-md mx-auto' : sheet ? 'grid w-max max-w-full gap-3' : 'w-full'}>
      {isAuthInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-lg font-medium">{tAuth('signIn.loading')}</p>
          </div>
        </div>
      )}

      <div className={variant === 'hero' ? 'space-y-4' : sheet ? 'contents' : 'space-y-2'}>
        {socialBlock(variant !== 'hero')}

        <div className={`relative ${fitRow} ${variant === 'hero' ? 'my-6' : 'my-2'}`}>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-transparent px-3 text-muted-foreground">OR</span>
          </div>
        </div>

        <div className={fitRow}>
          <EmailLoginForm
            from={from}
            locale={locale}
            compact={variant !== 'hero'}
            onError={(msg) => setError(msg)}
          />
        </div>

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
