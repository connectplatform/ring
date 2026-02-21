'use client'

import React, { useState } from 'react'
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google'
import { signIn } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
import { Loader2 } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'
import { defaultLocale } from '@/i18n-config'

interface GoogleSignInButtonGISProps {
  disabled?: boolean
  redirectUrl?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  onAuthStart?: () => void
  onAuthEnd?: () => void
  showSigningInStatus?: boolean // Show "Signing in..." status page during auth
}

/**
 * Modern Google Sign-In Button using @react-oauth/google (GIS Specialist Recommended)
 *
 * Features:
 * - Uses GIS specialist-recommended @react-oauth/google library
 * - Proper React integration and lifecycle management
 * - Automatic theme handling and styling
 * - One Tap compatible architecture
 * - React 19 useActionState compatible
 * - Accessible and responsive
 */
export default function GoogleSignInButtonGIS({
  disabled = false,
  redirectUrl = '/profile',
  className = '',
  variant = 'outline',
  size = 'default',
  onAuthStart,
  onAuthEnd,
  showSigningInStatus = true // Default to showing status page
}: GoogleSignInButtonGISProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, resolvedTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  
  // Extract locale from pathname (e.g., /uk/login -> uk)
  const locale = (pathname?.split('/')[1] || defaultLocale) as Locale

  // GIS Specialist recommended: Use GoogleLogin component for proper OAuth flow
  const handleGoogleSuccess = async (credentialResponse: any) => {
    console.log('🟢 Google GIS credential received')
    setIsLoading(true)
    onAuthStart?.()

    try {
      // Send JWT credential to google-one-tap credentials provider
      const result = await signIn('google-one-tap', {
        credential: credentialResponse.credential,
        redirect: false,
        callbackUrl: redirectUrl,
      })

        if (result?.ok) {
          console.log('🟢 Google authentication successful, waiting for session to propagate...')
          // GIS Fix: 100ms delay ensures session cookie is fully established before redirect
          // This prevents race conditions where NotificationProvider sees session but API calls fail
          // Pattern: Small timeout ensures session is established before redirect (AI-CONTEXT documented)
          await new Promise(resolve => setTimeout(resolve, 100))
          
          onAuthEnd?.()
          
          // Show "Signing in..." status page if enabled (improves UX during OAuth flow)
          if (showSigningInStatus) {
            const statusUrl = `${ROUTES.AUTH_STATUS('login', 'pending', locale)}?returnTo=${encodeURIComponent(redirectUrl)}`
            console.log('🟢 Showing signing in status, then redirecting to:', redirectUrl)
            router.push(statusUrl)
          } else {
            console.log('🟢 Session propagated, redirecting directly to:', redirectUrl)
            router.push(redirectUrl)
          }
        } else {
          console.error('🟢 Google authentication failed:', result?.error)
          setIsLoading(false)
          onAuthEnd?.()
        }
    } catch (error) {
      console.error('🟢 Google authentication error:', error)
      setIsLoading(false)
      onAuthEnd?.()
    }
  }

  // GIS Specialist recommended: Use GoogleLogin component for proper theming
  const currentTheme = theme === 'system' ? resolvedTheme : theme
  const gisTheme = currentTheme === 'dark' ? 'filled_black' : 'outline'

  return (
    <div className={`w-full ${className}`}>
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          console.log('🟢 Google Login component success')
          if (!disabled && !isLoading) {
            handleGoogleSuccess(credentialResponse)
          }
        }}
        onError={() => {
          console.error('🟢 Google Login component error')
          setIsLoading(false)
          onAuthEnd?.()
        }}
        theme={gisTheme}
        size="large"
        text="signin_with"
        shape="rectangular"
        useOneTap={false} // GIS specialist: disable One Tap for button-only usage
        containerProps={{
          style: {
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            borderRadius: '0',
            padding: '0',
            margin: '0'
          }
        }}
      />
    </div>
  )
}

// Type declarations are already defined in google-one-tap.tsx
