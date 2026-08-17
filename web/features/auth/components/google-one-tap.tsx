'use client'

import React, { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import { localeFromPathname } from '@/lib/pathname-without-locale'

/** GIS One Tap `color_scheme` — must match next-themes app chrome, not OS alone. */
type GisColorScheme = 'light' | 'dark'

// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean
            isSkippedMoment: () => boolean
          }) => void) => void
          renderButton: (element: HTMLElement | null, config: Record<string, unknown>) => void
          cancel: () => void
          storeCredential: (credential: unknown) => void
          getCredential: () => unknown
          oneTap: (config?: Record<string, unknown>) => void
          shutdown: () => void
        }
      }
    }
  }
}

interface GoogleOneTapProps {
  redirectUrl?: string
}

function gisColorSchemeFromTheme(resolvedTheme: string | undefined): GisColorScheme | null {
  if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return null
  return resolvedTheme
}

/**
 * Global Google One Tap — mounted in `AppClientShell` inside `ThemeProvider`.
 * Use `next/navigation` only (not next-intl `useRouter`).
 * Pass GIS `color_scheme` from next-themes `resolvedTheme` so the prompt matches
 * app light/dark (class + enableColorScheme). Leaving GIS on system default while
 * the page uses a forced or toggled theme produces a mismatched ("crooked") prompt.
 */
export default function GoogleOneTap({ redirectUrl }: GoogleOneTapProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { resolvedTheme } = useTheme()
  const [gisLoaded, setGisLoaded] = useState(false)
  const promptedRef = useRef(false)
  const appliedSchemeRef = useRef<GisColorScheme | null>(null)

  const locale = localeFromPathname(pathname)
  const oauthCallbackUrl = buildOAuthCallbackUrl(redirectUrl, locale)
  const colorScheme = gisColorSchemeFromTheme(resolvedTheme)

  // Load GIS script globally
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      setGisLoaded(true)
      return
    }

    const existing = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]',
    ) as HTMLScriptElement | null
    if (existing) {
      if (window.google?.accounts?.id) {
        setGisLoaded(true)
      } else {
        existing.addEventListener('load', () => setGisLoaded(true), { once: true })
      }
      return
    }

    const hl = localeFromPathname(pathname)
    const script = document.createElement('script')
    script.src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(hl)}`
    script.async = true
    script.defer = true
    script.onload = () => setGisLoaded(true)
    script.onerror = () => {
      console.error('[GIS] Failed to load Google Identity Services')
    }

    document.head.appendChild(script)
  }, [pathname])

  // Initialize / re-bind One Tap when script + theme are ready
  useEffect(() => {
    if (!gisLoaded || !colorScheme) return

    if (status === 'loading') return

    const sessionUser = session?.user
    if (status === 'authenticated' || sessionUser?.email || sessionUser?.id) {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel()
        } catch {
          // ignore
        }
      }
      promptedRef.current = false
      return
    }

    if (pathname?.includes('/login') || pathname?.includes('/auth') || pathname?.includes('/admin')) {
      return
    }

    if (!window.google?.accounts?.id) return

    try {
      const schemeChanged =
        appliedSchemeRef.current != null && appliedSchemeRef.current !== colorScheme
      if (schemeChanged && promptedRef.current) {
        try {
          window.google.accounts.id.cancel()
        } catch {
          // ignore
        }
        promptedRef.current = false
      }

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID!,
        locale: localeFromPathname(pathname),
        color_scheme: colorScheme,
        callback: async (response: { credential?: string }) => {
          try {
            const result = await signIn('google-one-tap', {
              credential: response.credential,
              redirect: false,
              callbackUrl: oauthCallbackUrl,
            })

            if (result?.ok) {
              router.push(oauthCallbackUrl)
            } else {
              console.error('[GIS] One Tap authentication failed:', result?.error)
            }
          } catch (error) {
            console.error('[GIS] One Tap authentication error:', error)
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
      })

      appliedSchemeRef.current = colorScheme

      const isMobile =
        typeof window !== 'undefined' &&
        (window.innerWidth < 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          ))

      if (!isMobile && !promptedRef.current) {
        const timer = window.setTimeout(() => {
          if (window.google?.accounts?.id && !promptedRef.current) {
            promptedRef.current = true
            window.google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                promptedRef.current = false
              }
            })
          }
        }, 1000)
        return () => window.clearTimeout(timer)
      }
    } catch (error) {
      console.error('[GIS] Failed to initialize Google One Tap:', error)
    }
  }, [
    gisLoaded,
    colorScheme,
    status,
    session,
    pathname,
    router,
    oauthCallbackUrl,
  ])

  // Cancel when user becomes authenticated
  useEffect(() => {
    if (status === 'authenticated' && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.cancel()
        promptedRef.current = false
      } catch (error) {
        console.error('[GIS] Error cancelling One Tap:', error)
      }
    }
  }, [status])

  useEffect(() => {
    return () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  return null
}
