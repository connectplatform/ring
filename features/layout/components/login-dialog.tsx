'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { signIn } from 'next-auth/react'
import { buildOAuthCallbackUrl } from '@/lib/auth/oauth-callback-url'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Props for the LoginDialog component
 * @interface LoginDialogProps
 * @property {boolean} open - Determines if the dialog is open
 * @property {() => Promise<void>} onCloseAction - Server Action to be called when closing the dialog
 */
interface LoginDialogProps {
  open: boolean
  onCloseAction: () => Promise<void>
}

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

/**
 * LoginDialog component
 * Renders a dialog for user login with Google Sign-In option
 * 
 * User steps:
 * 1. User sees the login dialog when it's opened (controlled by parent component)
 * 2. User can choose to sign in with Google
 * 3. On successful sign-in, user is redirected to the profile page
 * 4. User can close the dialog at any time
 * 
 * @param {LoginDialogProps} props - The component props
 * @returns {JSX.Element} The rendered LoginDialog component
 */
export default function LoginDialog({ open, onCloseAction }: LoginDialogProps) {
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('modules.auth')
  const locale = useLocale() as Locale

  /**
   * Handles the Google Sign-In process
   * Attempts to sign in the user and redirects to the profile page on success
   */
  const handleGoogleSignIn = async () => {
    try {
      const callbackUrl = buildOAuthCallbackUrl(undefined, locale)
      await signIn('google', { callbackUrl })
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      await onCloseAction()
    }
  }

  return (
    <Dialog open={open} onOpenChange={async (isOpen) => {
      if (!isOpen) {
        await onCloseAction()
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tAuth('signIn.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full max-w-sm"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {tAuth('signIn.providers.google')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
