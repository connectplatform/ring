'use client'

import React from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FcGoogle } from 'react-icons/fc'
import { Loader2 } from 'lucide-react'

interface GoogleSignInButtonGISProps {
  disabled?: boolean
  redirectUrl?: string
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
}

/**
 * Modern Google Sign-In Button using Google Identity Services
 * 
 * Features:
 * - No page redirects
 * - Seamless authentication experience
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
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSuccess = async (credentialResponse: any) => {
    console.log('🟢 Google Sign-In Button Success:', credentialResponse)
    console.log('🟢 Credential length:', credentialResponse?.credential?.length || 0)

    try {
      setIsLoading(true)

      const result = await signIn('google-one-tap', {
        credential: credentialResponse.credential,
        redirect: false,
      })

      console.log('🟢 Sign-in result:', result)
      console.log('🟢 Sign-in error:', result?.error)
      console.log('🟢 Sign-in status:', result?.status)

      if (result?.ok) {
        console.log('🟢 Authentication successful, redirecting to:', redirectUrl)
        router.push(redirectUrl)
      } else {
        console.error('🟢 Google sign-in failed:', result?.error)
        // You could show an error toast here
      }
    } catch (error) {
      console.error('🟢 Google sign-in error:', error)
      // You could show an error toast here
    } finally {
      setIsLoading(false)
    }
  }

  const handleError = () => {
    console.error('Google sign-in failed')
    setIsLoading(false)
    // You could show an error toast here
  }

  return (
    <div className={className}>
      {isLoading || disabled ? (
        <Button
          variant={variant}
          size={size}
          disabled={true}
          className="w-full"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </Button>
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          theme={variant === 'outline' ? 'outline' : 'filled_blue'}
          size={size === 'sm' ? 'medium' : size === 'lg' ? 'large' : 'large'}
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
          width="100%"
          useOneTap={false} // Disable One Tap here since we have a dedicated component
        />
      )}
    </div>
  )
}