'use client'

import { signIn } from 'next-auth/react'

/** GIS One Tap `color_scheme` — must match next-themes app chrome, not the OS alone. */
export type GisColorScheme = 'light' | 'dark'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt: (callback?: (notification: {
            isNotDisplayed?: () => boolean
            isSkippedMoment?: () => boolean
          }) => void) => void
          renderButton: (element: HTMLElement | null, config: Record<string, unknown>) => void
          cancel: () => void
          storeCredential?: (credential: unknown) => void
          getCredential?: () => unknown
          oneTap?: (config?: Record<string, unknown>) => void
          shutdown?: () => void
        }
      }
    }
  }
}

const SCRIPT_SELECTOR = 'script[src*="accounts.google.com/gsi/client"]'
/**
 * Session cookie propagation grace period before `router.push` (documented in
 * `AI-CONTEXT/ring-platform.org/implementations/google-gis-auth-delayed-redirect-fix-2026-01-06.json`).
 */
const SESSION_COOKIE_PROPAGATION_DELAY_MS = 100

let scriptPromise: Promise<void> | null = null
let initKey: string | null = null
let lastColorScheme: GisColorScheme | null = null
const credentialHandlers: Array<(credential: string) => void | Promise<void>> = []
let fallbackHandler: ((credential: string) => void | Promise<void>) | null = null

export function gisColorSchemeFromTheme(resolvedTheme: string | undefined): GisColorScheme | null {
  if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return null
  return resolvedTheme
}

/**
 * Latest mounted consumer wins. Unmount removes only that consumer, while
 * preserving a fallback reference in case a hosting modal unmounts mid-flight.
 */
export function bindGisCredentialHandler(
  handler: (credential: string) => void | Promise<void>,
): () => void {
  credentialHandlers.push(handler)
  fallbackHandler = handler
  return () => {
    const index = credentialHandlers.lastIndexOf(handler)
    if (index >= 0) credentialHandlers.splice(index, 1)
  }
}

export function loadGisScript(locale: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => resolve()
    const fail = () => {
      scriptPromise = null
      reject(new Error('GIS script failed'))
    }
    const existing = document.querySelector(SCRIPT_SELECTOR) as HTMLScriptElement | null
    if (existing) {
      if (window.google?.accounts?.id) {
        finish()
        return
      }
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(locale)}`
    script.async = true
    script.defer = true
    script.onload = finish
    script.onerror = fail
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * GIS client for One Tap (`prompt`) only.
 *
 * The login button is the Ring control in `google-signin-button-gis.tsx` and uses
 * Auth.js `signIn('google')`. Do not set `use_fedcm_for_button`: that flag makes
 * Chrome draw the personalized account button.
 * Do not pass `ux_mode: 'popup'` here: One Tap + FedCM delivers a JWT credential to `callback`.
 */
export function ensureGisClient(options: {
  clientId: string
  locale: string
  colorScheme: GisColorScheme
}): { reinitialized: boolean; schemeChanged: boolean } {
  const googleId = window.google?.accounts?.id
  if (!googleId || !options.clientId) {
    return { reinitialized: false, schemeChanged: false }
  }
  const schemeChanged = lastColorScheme !== null && lastColorScheme !== options.colorScheme
  if (schemeChanged) {
    cancelGisPrompt()
  }
  const key = `${options.clientId}|${options.locale}|${options.colorScheme}`
  if (initKey === key) {
    return { reinitialized: false, schemeChanged }
  }
  googleId.initialize({
    client_id: options.clientId,
    locale: options.locale,
    color_scheme: options.colorScheme,
    callback: (response: { credential?: string }) => {
      const credential = response?.credential
      if (!credential) return
      const activeHandler =
        credentialHandlers[credentialHandlers.length - 1] ?? fallbackHandler
      if (activeHandler) void activeHandler(credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    context: 'signin',
    itp_support: true,
    use_fedcm_for_prompt: true,
  })
  initKey = key
  lastColorScheme = options.colorScheme
  return { reinitialized: true, schemeChanged }
}

export function cancelGisPrompt(): void {
  try {
    window.google?.accounts?.id.cancel()
  } catch {
    // FedCM may already have closed the prompt.
  }
}

/**
 * Verify the GIS ID token through Auth.js `google-one-tap` CredentialsProvider,
 * then wait 100ms so the session cookie propagates before client navigation.
 */
export async function completeGoogleCredentialSignIn(
  credential: string,
  callbackUrl: string,
): Promise<boolean> {
  try {
    const result = await signIn('google-one-tap', {
      credential,
      redirect: false,
      callbackUrl,
    })
    if (!result?.ok || result.error) {
      cancelGisPrompt()
      console.error('[GIS] credential sign-in failed:', result?.error)
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, SESSION_COOKIE_PROPAGATION_DELAY_MS))
    return true
  } catch (error) {
    cancelGisPrompt()
    console.error('[GIS] credential sign-in error:', error)
    return false
  }
}
