'use client'

import React, { useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
import { Loader2 } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface GoogleSignInButtonGISProps {
  disabled?: boolean
  redirectUrl?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
}

/**
 * Modern Google Sign-In Button using Google Identity Services (GIS)
 *
 * Features:
 * - No page redirects
 * - Seamless authentication experience using GIS
 * - Works with Auth.js v5 session management
 * - React 19 useActionState compatible
 * - Accessible and responsive
 */
export default function GoogleSignInButtonGIS({
  disabled = false,
  redirectUrl = '/profile',
  className = '',
  variant = 'outline',
  size = 'default'
}: GoogleSignInButtonGISProps) {
  const router = useRouter()
  const { theme, resolvedTheme } = useTheme()
  const locale = useLocale() as 'en' | 'uk'
  const buttonRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [gisLoaded, setGisLoaded] = React.useState(false)

  // Load Google Identity Services script
  useEffect(() => {
    // Check if GIS is already loaded
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      setGisLoaded(true)
      return
    }

    // Load GIS script if not already loaded
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      console.log('🟢 Google Identity Services loaded')
      setGisLoaded(true)
    }
    script.onerror = () => {
      console.error('🟢 Failed to load Google Identity Services')
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup script if component unmounts
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Initialize GIS button when script is loaded
  useEffect(() => {
    if (!gisLoaded || !buttonRef.current) return

    try {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID!,
        callback: async (response: any) => {
          console.log('🟢 GIS button callback received')
          setIsLoading(true)

          try {
            // Use the google-one-tap credentials provider for consistent handling
            const result = await signIn('google-one-tap', {
              credential: response.credential,
              redirect: false,
            })

            if (result?.ok) {
              console.log('🟢 GIS authentication successful, redirecting to status page')
              // Redirect to "Signing in..." status page with return destination
              const statusUrl = ROUTES.AUTH_STATUS('login', 'pending', locale)
              const finalUrl = `${statusUrl}?returnTo=${encodeURIComponent(redirectUrl)}`
              router.push(finalUrl)
            } else {
              console.error('🟢 GIS authentication failed:', result?.error)
              setIsLoading(false)
            }
          } catch (error) {
            console.error('🟢 GIS authentication error:', error)
            setIsLoading(false)
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      // Determine GIS theme based on current app theme
      const currentTheme = theme === 'system' ? resolvedTheme : theme
      const gisTheme = currentTheme === 'dark' ? 'filled_black' : 'outline'

      // Get container width for full-width button
      const containerWidth = buttonRef.current.parentElement?.offsetWidth || buttonRef.current.offsetWidth || 400

      // Render the GIS button
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: gisTheme,
        size: 'large',
        width: containerWidth,
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        height: 48, // Increased height
      })

      console.log('🟢 GIS button rendered')
    } catch (error) {
      console.error('🟢 Failed to initialize GIS button:', error)
    }
  }, [gisLoaded, redirectUrl, router, theme, resolvedTheme, locale])

  // Fallback button for when GIS fails to load or for development
  const handleFallbackSignIn = async () => {
    try {
      setIsLoading(true)
      console.log('🟢 Using fallback Google sign-in...')

      const result = await signIn('google', {
        redirect: false,
        callbackUrl: redirectUrl
      })

      console.log('🟢 Fallback sign-in result:', result)

      if (result?.error) {
        console.error('🟢 Fallback Google sign-in failed:', result.error)
        setIsLoading(false)
      } else if (result?.url) {
        console.log('🟢 Fallback authentication successful, redirecting to status page')
        // Redirect to "Signing in..." status page with return destination
        const statusUrl = ROUTES.AUTH_STATUS('login', 'pending', locale)
        const finalUrl = `${statusUrl}?returnTo=${encodeURIComponent(redirectUrl)}`
        router.push(finalUrl)
      } else {
        console.log('🟢 Fallback sign-in completed without redirect')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('🟢 Fallback Google sign-in error:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {gisLoaded ? (
        // GIS button container - key ensures re-render on theme change
        <div
          key={`${theme}-${resolvedTheme}`}
          ref={buttonRef}
          className="w-full flex justify-center overflow-hidden [&_iframe]:!border-0 [&_iframe]:!m-0 [&_iframe]:!p-0 [&_iframe]:!shadow-none [&_iframe]:!outline-none"
          style={{ 
            minHeight: '48px',
            backgroundColor: 'transparent'
          }}
        />
      ) : (
        // Fallback button while GIS loads
        <Button
          onClick={handleFallbackSignIn}
          disabled={disabled || isLoading}
          variant={variant}
          size={size}
          className="w-full justify-center font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <FcGoogle className="mr-2 h-4 w-4" />
              Sign in as Ray
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// Type declarations are already defined in google-one-tap.tsx