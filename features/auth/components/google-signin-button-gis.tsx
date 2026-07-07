'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import { safePostAuthRedirect } from '@/lib/auth/safe-post-auth-redirect'
import type { Locale } from '@/i18n/shared'

interface GoogleSignInButtonGISProps {
  disabled?: boolean
  /** Omitted = profile in the active next-intl locale (via `safePostAuthRedirect`). */
  redirectUrl?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  onAuthStart?: () => void
  onAuthEnd?: () => void
  showSigningInStatus?: boolean
}

/**
 * Google sign-in: full-page OAuth via Auth.js (`signIn('google')`).
 *
 * - **Locale**: Label from `next-intl` (`modules.auth`), not the GIS iframe (avoids browser-locale mismatch).
 * - **No popup**: Same-tab redirect — avoids popup blockers / FedCM quirks from embedded `GoogleLogin`.
 *
 * `useLocale()` (not pathname) stays correct under `localePrefix: 'as-needed'` (e.g. `/login` is not a locale).
 */
export default function GoogleSignInButtonGIS({
  disabled = false,
  redirectUrl: redirectUrlProp,
  className = '',
  variant = 'outline',
  size = 'default',
  onAuthStart,
  onAuthEnd,
  showSigningInStatus = true,
}: GoogleSignInButtonGISProps) {
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale
  const redirectUrl = safePostAuthRedirect(redirectUrlProp, locale)
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = () => {
    if (disabled || isLoading) return
    onAuthStart?.()
    setIsLoading(true)
    const callbackUrl = buildOAuthCallbackUrl(redirectUrlProp, locale)

    void (async () => {
      try {
        await signIn('google', { callbackUrl })
      } catch (e) {
        console.error('Google sign-in error:', e)
        setIsLoading(false)
        onAuthEnd?.()
      }
    })()
  }

  const sizeProp = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'

  return (
    <Button
      type="button"
      variant={variant}
      size={sizeProp}
      className={`w-full min-h-12 font-medium ${className}`}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-label={tAuth('signIn.providers.google')}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      )}
      {tAuth('signIn.providers.google')}
    </Button>
  )
}
