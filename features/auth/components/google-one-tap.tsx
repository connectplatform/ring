'use client'

import React, { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { ROUTES } from '@/constants/routes'

// Type declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (callback?: (notification: any) => void) => void
          renderButton: (element: HTMLElement | null, config: any) => void
          cancel: () => void
          storeCredential: (credential: any) => void
          getCredential: () => any
          oneTap: (config?: any) => void
          shutdown: () => void
        }
      }
    }
  }
}

interface GoogleOneTapProps {
  redirectUrl?: string
}

/**
 * Global Google One Tap Component
 *
 * Loads Google Identity Services (GIS) script globally and manages One Tap popup.
 * Only shows for visitor users (not authenticated) and is hidden on login pages.
 *
 * Critical for mobile compatibility - prevents GIS script loading conflicts.
 */
export default function GoogleOneTap({ redirectUrl }: GoogleOneTapProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { theme, resolvedTheme } = useTheme()
  const [gisLoaded, setGisLoaded] = useState(false)
  const [gisInitialized, setGisInitialized] = useState(false)

  // Get locale from pathname
  const getLocale = (): 'en' | 'uk' | 'ru' => {
    const pathLocale = pathname?.split('/')[1]
    if (pathLocale === 'uk' || pathLocale === 'ru') {
      return pathLocale
    }
    return 'en'
  }

  const locale = getLocale()
  const profileUrl = ROUTES.PROFILE(locale)
  const effectiveRedirectUrl = redirectUrl || profileUrl

  // Load GIS script globally
  useEffect(() => {
    // Skip if already loaded
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      console.log('🟢 GIS already loaded globally')
      setGisLoaded(true)
      return
    }

    // Skip if script is already being loaded
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      console.log('🟢 GIS script already in DOM')
      return
    }

    console.log('🟢 Loading Google Identity Services script globally...')

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      console.log('🟢 Google Identity Services loaded globally')
      setGisLoaded(true)
    }
    script.onerror = () => {
      console.error('🟢 Failed to load Google Identity Services globally')
    }

    document.head.appendChild(script)
  }, [])

  // Initialize GIS One Tap when script is loaded
  useEffect(() => {
    if (!gisLoaded || gisInitialized) return

    // Skip if user is authenticated
    if (status === 'authenticated' || (session && 'user' in session)) {
      console.log('🟢 Skipping GIS One Tap - user already authenticated')
      return
    }

    // Skip on login/auth pages
    if (pathname?.includes('/login') || pathname?.includes('/auth') || pathname?.includes('/admin')) {
      console.log('🟢 Skipping GIS One Tap - on auth page')
      return
    }

    try {
      console.log('🟢 Initializing Google One Tap...')

      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID!,
        callback: async (response: any) => {
          console.log('🟢 One Tap callback received')
          try {
            // Send GIS credential to google-one-tap credentials provider
            const result = await signIn('google-one-tap', {
              credential: response.credential,
              redirect: false,
              callbackUrl: effectiveRedirectUrl,
            })

            if (result?.ok) {
              console.log('🟢 One Tap authentication successful')
              // Show "login in progress" page first, then redirect to profile
              const loginPendingUrl = `/${locale}/auth/status/login/pending?returnTo=${encodeURIComponent(effectiveRedirectUrl)}`
              router.push(loginPendingUrl)
            } else {
              console.error('🟢 One Tap authentication failed:', result?.error)
            }
          } catch (error) {
            console.error('🟢 One Tap authentication error:', error)
          }
        },
        auto_select: false, // Don't auto-select accounts
        cancel_on_tap_outside: true,
        context: 'signin',
        ux_mode: 'popup', // Use popup mode for better mobile compatibility
        use_fedcm_for_prompt: true, // Use FedCM when available
      })

      setGisInitialized(true)
      console.log('🟢 Google One Tap initialized successfully')

      // Only prompt on desktop/tablet - mobile has issues with One Tap popup
      const isMobile = typeof window !== 'undefined' &&
        (window.innerWidth < 768 ||
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

      if (!isMobile) {
        // Prompt One Tap for desktop users
        setTimeout(() => {
          if (window.google?.accounts?.id) {
            console.log('🟢 Prompting Google One Tap for desktop user')
            window.google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log('🟢 One Tap not displayed or skipped')
              }
            })
          }
        }, 1000) // Delay to ensure page is fully loaded
      } else {
        console.log('🟢 Skipping One Tap prompt on mobile device')
      }

    } catch (error) {
      console.error('🟢 Failed to initialize Google One Tap:', error)
    }
  }, [gisLoaded, gisInitialized, status, session, pathname, router, effectiveRedirectUrl])

  // Handle authentication state changes
  useEffect(() => {
    if (status === 'authenticated' && window.google?.accounts?.id) {
      // Cancel any pending One Tap prompts when user becomes authenticated
      try {
        window.google.accounts.id.cancel()
        console.log('🟢 Cancelled One Tap prompt - user authenticated')
      } catch (error) {
        console.error('🟢 Error cancelling One Tap:', error)
      }
    }
  }, [status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.cancel()
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }, [])

  // This component doesn't render anything visible - it manages the global GIS state
  return null
}
