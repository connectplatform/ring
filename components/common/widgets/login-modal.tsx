'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { X, Loader2 } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { ROUTES } from '@/constants/routes'
import { signInWithGoogle, GoogleSignInState } from '@/app/_actions/auth'

interface LoginModalProps {
  isOpen: boolean
  closeAction: () => Promise<void>
  successAction: () => Promise<void>
}

const DEFAULT_LOCALE = 'en' as const

function GoogleSignInButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('modules.auth')
  
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('signingIn') || 'Signing in...'}
        </>
      ) : (
        <>
          <FcGoogle className="mr-2 h-4 w-4" />
          {t('signInWithGoogle') || 'Sign in with Google'}
        </>
      )}
    </Button>
  )
}

export default function LoginModal({ isOpen, closeAction, successAction }: LoginModalProps) {
  const t = useTranslations('modules.auth')
  const router = useRouter()
  const locale = useLocale() as 'en' | 'uk'
  
  const [state, formAction] = useActionState<GoogleSignInState | null, FormData>(
    async (prevState: GoogleSignInState | null, formData: FormData) => {
      try {
        const result = await signInWithGoogle(prevState, formData)
        if (result.success) {
          await successAction()
          router.replace(ROUTES.PROFILE(locale))
        }
        return result
      } catch (error) {
        return {
          error: t('errorSigningIn') || 'Error signing in. Please try again.'
        }
      }
    },
    null
  )

  const handleClose = async () => {
    try {
      await closeAction()
    } catch (error) {
      console.error('Error closing modal:', error)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50" 
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-card text-card-foreground rounded-lg p-6 shadow-xl w-full max-w-md relative">
              <Button
                onClick={handleClose}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <h2 className="text-2xl font-bold text-center mb-6">
                {t('login') || 'Login'}
              </h2>
              
              <form action={formAction}>
                <input type="hidden" name="redirectUrl" value={ROUTES.PROFILE(locale)} />
                <input type="hidden" name="locale" value={locale} />
                <GoogleSignInButton />
              </form>

              {state?.error && (
                <Alert className="mt-4 bg-destructive/15 text-destructive">
                  <AlertTitle>{state.error}</AlertTitle>
                </Alert>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 