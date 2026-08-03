'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import type { Locale } from '@/i18n/shared'

interface TelegramSignInButtonProps {
  disabled?: boolean
  /** Omitted = profile via buildOAuthCallbackUrl / safe post-auth redirect. */
  redirectUrl?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  onAuthStart?: () => void
  onAuthEnd?: () => void
}

/**
 * Telegram sign-in: full-page Auth.js OIDC redirect (`signIn('telegram')`).
 *
 * - Same-tab redirect (matches Google GIS button UX) — avoids popup/COOP issues.
 * - Requires AUTH_TELEGRAM_ID / AUTH_TELEGRAM_SECRET (BotFather Web Login).
 * - Privacy: Ring reads id, name, username, photo from Telegram profile scope.
 * - Hidden when `/api/auth/providers` has no `telegram` (OIDC not configured).
 *
 * Truth lens: telegram_login_widget_specialist
 */
export default function TelegramSignInButton({
  disabled = false,
  redirectUrl: redirectUrlProp,
  className = '',
  variant = 'outline',
  size = 'default',
  onAuthStart,
  onAuthEnd,
}: TelegramSignInButtonProps) {
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale
  const [isLoading, setIsLoading] = useState(false)
  const [oidcReady, setOidcReady] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/providers', { cache: 'no-store' })
        const json = (await res.json()) as Record<string, unknown>
        if (!cancelled) setOidcReady(Boolean(json?.telegram))
      } catch {
        if (!cancelled) setOidcReady(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleClick = () => {
    if (disabled || isLoading || !oidcReady) return
    onAuthStart?.()
    setIsLoading(true)
    const callbackUrl = buildOAuthCallbackUrl(redirectUrlProp, locale)

    void (async () => {
      try {
        await signIn('telegram', { callbackUrl })
      } catch (e) {
        console.error('Telegram sign-in error:', e)
        setIsLoading(false)
        onAuthEnd?.()
      }
    })()
  }

  // Avoid dead-end UX: button was calling signIn('telegram') while provider absent.
  if (oidcReady === false) return null
  if (oidcReady === null) return null

  const sizeProp = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'

  return (
    <Button
      type="button"
      variant={variant}
      size={sizeProp}
      className={`w-full min-h-12 font-medium ${className}`}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-label={tAuth('signIn.providers.telegram')}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <svg
          className="mr-2 h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden
          fill="currentColor"
        >
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.064-1.226-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      )}
      {tAuth('signIn.providers.telegram')}
    </Button>
  )
}
