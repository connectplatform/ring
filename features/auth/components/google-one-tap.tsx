'use client'

import React, { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useGoogleOneTapLogin } from '@react-oauth/google'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

interface GoogleOneTapProps {
  disabled?: boolean
  redirectUrl?: string
}

/**
 * Google Identity Services One Tap Component
 * Modern, seamless authentication without page redirects
 * 
 * Features:
 * - Automatic sign-in for Google users
 * - No redirects or pre-landing screens
 * - Works alongside traditional Google sign-in button
 * - React 19 and Next.js 15 compatible
 */
export function GoogleOneTap({
  disabled = false,
  redirectUrl = '/profile'
}: GoogleOneTapProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  console.log('🔵 GoogleOneTap component rendered, session status:', status, 'session:', !!session)
  console.log('🔵 GoogleOneTap disabled:', disabled, 'final disabled state:', status === 'authenticated' || disabled)
  console.log('🔵 GoogleOneTap client ID:', process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID)

  // Check if Google Identity Services script is loaded
  console.log('🔵 Google GIS loaded:', typeof window !== 'undefined' && window.google)
  console.log('🔵 GoogleOneTapLogin available:', typeof window !== 'undefined' && window.google?.accounts?.id?.prompt)

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      console.log('🟢 Google One Tap Success - Full credential response:', credentialResponse)
      console.log('🟢 Credential length:', credentialResponse?.credential?.length || 0)

      try {
        // Use Auth.js v5 signIn with our custom credentials provider
        const result = await signIn('google-one-tap', {
          credential: credentialResponse.credential,
          redirect: false,
        })

        console.log('🟢 Sign-in result:', result)
        console.log('🟢 Sign-in error:', result?.error)
        console.log('🟢 Sign-in status:', result?.status)

        if (result?.ok) {
          console.log('🟢 Authentication successful, redirecting to:', redirectUrl)
          // Successful authentication
          router.push(redirectUrl)
        } else {
          console.error('🟢 One Tap sign-in failed:', result?.error)
          console.error('🟢 Full result object:', result)
        }
      } catch (error) {
        console.error('🟢 One Tap authentication error:', error)
        console.error('🟢 Error details:', error)
      }
    },
    onError: () => {
      console.error('🟢 Google One Tap login failed or was cancelled')
    },
    disabled: status === 'authenticated' || disabled,
    auto_select: true,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true, // Use Federated Credential Management API when available
  })

  // For debugging: Show a manual test button (temporary)
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div>🔵 Google One Tap Debug:</div>
      <div>Session: {status}</div>
      <div>One Tap: {status === 'authenticated' || disabled ? 'Disabled' : 'Active'}</div>
      <div>GIS Loaded: {typeof window !== 'undefined' && window.google ? 'Yes' : 'No'}</div>
      <button
        onClick={() => {
          console.log('🔴 Manual One Tap test - triggering Google One Tap')
          if (typeof window !== 'undefined' && window.google?.accounts?.id) {
            window.google.accounts.id.prompt((notification) => {
              console.log('🔴 One Tap prompt notification:', notification)
            })
          } else {
            console.log('🔴 Google Identity Services not available')
          }
        }}
        style={{
          marginTop: '8px',
          padding: '6px 12px',
          background: '#4285F4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          width: '100%'
        }}
      >
        Test One Tap
      </button>
    </div>
  )
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize?: (config: any) => void
          prompt?: (callback?: (notification: any) => void) => void
          renderButton?: (parent: HTMLElement, options: any) => void
          disableAutoSelect?: () => void
          storeCredential?: (credential: any, callback?: () => void) => void
          cancel?: () => void
          onGoogleLibraryLoad?: () => void
          revoke?: (hint: string, callback: (done: any) => void) => void
        }
      }
    }
  }
}

export {}