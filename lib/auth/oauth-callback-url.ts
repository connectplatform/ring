import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  safePostAuthRedirect,
  safePostAuthReturnTo,
} from '@/lib/auth/safe-post-auth-redirect'

/** Validated post-OAuth `callbackUrl` for Auth.js `signIn` (locale-aware, no pending hop). */
export function buildOAuthCallbackUrl(returnTo: string | undefined, locale: Locale): string {
  return safePostAuthRedirect(returnTo, locale)
}

/** Explicit failure landing (manual retries / blocked flows). */
export function buildOAuthFailureUrl(returnTo: string | undefined, locale: Locale): string {
  const returnToParam = safePostAuthReturnTo(returnTo, locale)
  const failed = ROUTES.AUTH_STATUS('login', 'failed', locale)
  return `${failed}?${new URLSearchParams({ returnTo: returnToParam }).toString()}`
}
