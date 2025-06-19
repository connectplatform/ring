'use client'

import React from 'react'
import { useTranslation } from '@/node_modules/react-i18next'
import { FcGoogle } from 'react-icons/fc'
import { signIn } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
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
  const { t } = useTranslation()

  /**
   * Handles the Google Sign-In process
   * Attempts to sign in the user and redirects to the profile page on success
   */
  const handleGoogleSignIn = async () => {
    try {
      await signIn('google', { callbackUrl: ROUTES.PROFILE(DEFAULT_LOCALE) })
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
          <DialogTitle>{t('signIn')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full max-w-sm"
          >
            <FcGoogle className="mr-2 h-4 w-4" />
            {t('signInWithGoogle')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
