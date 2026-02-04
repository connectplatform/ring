'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { X } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import GoogleSignInButtonGIS from '@/features/auth/components/google-signin-button-gis'

interface LoginModalProps {
  isOpen: boolean
  closeAction: () => Promise<void>
  successAction: () => Promise<void>
}

export default function LoginModal({ isOpen, closeAction, successAction }: LoginModalProps) {
  const t = useTranslations('modules.auth')
  const router = useRouter()
  const locale = useLocale() as 'en' | 'uk'
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)

  // Handle successful authentication
  useEffect(() => {
    if (isOpen && status === 'authenticated' && session) {
      successAction()
      router.replace(ROUTES.PROFILE(locale))
      closeAction()
    }
  }, [isOpen, status, session, successAction, router, locale, closeAction])

  const handleClose = async () => {
    try {
      setError(null)
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
              
              <GoogleSignInButtonGIS
                redirectUrl={ROUTES.PROFILE(locale)}
                className="w-full"
                variant="outline"
                size="lg"
                onAuthStart={() => setError(null)}
                onAuthEnd={() => {
                  // Auth end handled by useEffect above
                }}
              />

              {error && (
                <Alert className="mt-4 bg-destructive/15 text-destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 