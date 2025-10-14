'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useGoogleOneTapLogin } from '@react-oauth/google'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { signIn } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'

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
 * - Automatically disabled when auth modal is open
 */
export function GoogleOneTap({
  disabled = false,
  redirectUrl = '/profile'
}: GoogleOneTapProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const locale = useLocale() as 'en' | 'uk' | 'ru'
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Detect if auth modal/dialog is open by checking for dialog elements
  useEffect(() => {
    const checkModalState = () => {
      // Check if any dialog/modal is currently open
      const dialogOpen = document.querySelector('[role="dialog"]') !== null
      const modalOpen = document.querySelector('.modal') !== null
      setIsModalOpen(dialogOpen || modalOpen)
    }

    // Check initially
    checkModalState()

    // Set up a mutation observer to detect when modals open/close
    const observer = new MutationObserver(checkModalState)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'class']
    })

    return () => observer.disconnect()
  }, [])

  // Cancel One Tap prompt when modal opens
  useEffect(() => {
    if (isModalOpen && typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.cancel()
    }
  }, [isModalOpen])

  const isDisabled = status === 'authenticated' || disabled || isModalOpen

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      console.log('Google One Tap: Authentication successful')

      try {
        // Use Auth.js v5 signIn with our custom credentials provider
        const result = await signIn('google-one-tap', {
          credential: credentialResponse.credential,
          redirect: false,
        })

        if (result?.ok) {
          console.log('Google One Tap: Sign-in successful, redirecting to status page')
          // Redirect to "Signing in..." status page with return destination
          const statusUrl = ROUTES.AUTH_STATUS('login', 'pending', locale)
          const finalUrl = `${statusUrl}?returnTo=${encodeURIComponent(redirectUrl)}`
          router.push(finalUrl)
        } else {
          console.error('Google One Tap: Sign-in failed:', result?.error)
        }
      } catch (error) {
        console.error('Google One Tap: Authentication error:', error)
      }
    },
    onError: () => {
      console.error('Google One Tap: Login failed or was cancelled')
    },
    disabled: isDisabled,
    auto_select: false, // Don't auto-select to avoid interrupting user
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  })

  // No visual component - One Tap is handled by Google's UI
  return null
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