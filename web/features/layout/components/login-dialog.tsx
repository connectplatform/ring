'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import GoogleSignInButtonGIS from '@/features/auth/components/google-signin-button-gis'

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
  const tAuth = useTranslations('modules.auth')

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
        <GoogleSignInButtonGIS
          className="w-full"
          onAuthStart={() => {
            void onCloseAction()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
