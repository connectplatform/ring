'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
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
        <FcGoogle className="mr-2 h-5 w-5 shrink-0" aria-hidden />
      )}
      {tAuth('signIn.providers.google')}
    </Button>
  )
}
