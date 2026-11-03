'use client'

import React, { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import { localeFromPathname } from '@/lib/pathname-without-locale'
import {
  cancelGisPrompt,
  completeGoogleCredentialSignIn,
  ensureGisClient,
  gisColorSchemeFromTheme,
  loadGisScript,
  bindGisCredentialHandler,
} from '@/features/auth/lib/gis-client'

interface GoogleOneTapProps {
  redirectUrl?: string
}

function isAuthSurface(pathname: string | null): boolean {
  return Boolean(
    pathname?.includes('/login') ||
      pathname?.includes('/auth') ||
      pathname?.includes('/admin'),
  )
}

/**
 * Global Google One Tap — mounted in `AppClientShell` inside `ThemeProvider`.
 * Use `next/navigation` only (not next-intl `useRouter`).
 * FedCM prompt -> credential callback -> Auth.js `google-one-tap` -> 100ms cookie delay -> redirect.
 * The login button does not use this client. It is the Ring button and `signIn('google')`.
 */
export default function GoogleOneTap({ redirectUrl }: GoogleOneTapProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { resolvedTheme } = useTheme()
  const promptedRef = useRef(false)

  const locale = localeFromPathname(pathname)
  const oauthCallbackUrl = buildOAuthCallbackUrl(redirectUrl, locale)
  const colorScheme = gisColorSchemeFromTheme(resolvedTheme)
  const clientId = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID ?? ''

  useEffect(() => {
    if (!colorScheme || !clientId) return
    if (status === 'loading') return

    const sessionUser = session?.user
    if (status === 'authenticated' || sessionUser?.email || sessionUser?.id) {
      cancelGisPrompt()
      promptedRef.current = false
      return
    }

    if (isAuthSurface(pathname)) {
      cancelGisPrompt()
      promptedRef.current = false
      return
    }

    let cancelled = false
    const timerRef = { id: 0 }
    const unbind = bindGisCredentialHandler(async (credential) => {
      const ok = await completeGoogleCredentialSignIn(credential, oauthCallbackUrl)
      if (ok) {
        router.push(oauthCallbackUrl)
      }
    })

    void (async () => {
      try {
        await loadGisScript(locale)
        if (cancelled || !window.google?.accounts?.id) return

        const { schemeChanged } = ensureGisClient({ clientId, locale, colorScheme })
        if (schemeChanged) {
          promptedRef.current = false
        }

        const isMobile =
          window.innerWidth < 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        if (isMobile || promptedRef.current) return

        timerRef.id = window.setTimeout(() => {
          if (cancelled || promptedRef.current || !window.google?.accounts?.id) return
          promptedRef.current = true
          window.google.accounts.id.prompt()
        }, 1000)
      } catch (error) {
        console.error('[GIS] Failed to initialize Google One Tap:', error)
      }
    })()

    return () => {
      cancelled = true
      unbind()
      if (timerRef.id) window.clearTimeout(timerRef.id)
    }
  }, [clientId, colorScheme, locale, oauthCallbackUrl, pathname, router, session, status])

  // Cancel any open One Tap prompt as soon as user becomes authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      cancelGisPrompt()
      promptedRef.current = false
    }
  }, [status])

  useEffect(() => {
    return () => cancelGisPrompt()
  }, [])

  return null
}
