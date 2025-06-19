'use client'

import React from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { signInWithProvider, AuthFormState } from '@/app/actions/auth'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

interface LoginFormProps {
  from?: string
}

function ProviderButton({ 
  provider, 
  icon, 
  children 
}: { 
  provider: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
  const { pending } = useFormStatus()
  
  return (
    <Button
      type="submit"
      name="provider"
      value={provider}
      disabled={pending}
      variant="outline"
      className="w-full h-12 text-base font-medium"
    >
      {icon}
      {pending ? 'Signing in...' : children}
    </Button>
  )
}

function LoginFormContent({ from }: { from?: string }) {
  const { t } = useTranslation()
  const [state, formAction] = useActionState<AuthFormState | null, FormData>(
    signInWithProvider,
    null
  )

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    },
    exit: { opacity: 0, y: 20 }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-sm p-8 bg-card text-card-foreground rounded-lg shadow-lg"
      >
        <motion.h1
          variants={itemVariants}
          className="text-3xl font-bold text-center mb-8"
        >
          {t('login') || 'Sign In'}
        </motion.h1>

        {/* Show error message if any */}
        <AnimatePresence>
          {state?.error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show success message if any */}
        <AnimatePresence>
          {state?.success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <form action={formAction} className="space-y-4">
          {/* Hidden field for redirect URL */}
          <input type="hidden" name="redirectTo" value={from || ROUTES.PROFILE(DEFAULT_LOCALE)} />
          
          <motion.div variants={itemVariants}>
            <ProviderButton 
              provider="google" 
              icon={<FcGoogle className="mr-2 h-5 w-5" />}
            >
              {t('signInWithGoogle') || 'Sign in with Google'}
            </ProviderButton>
          </motion.div>

          <motion.div variants={itemVariants}>
            <ProviderButton 
              provider="apple" 
              icon={<AiFillApple className="mr-2 h-5 w-5" />}
            >
              {t('signInWithApple') || 'Sign in with Apple'}
            </ProviderButton>
          </motion.div>

          <motion.div variants={itemVariants}>
            <ProviderButton 
              provider="metamask" 
              icon={<FaEthereum className="mr-2 h-5 w-5" />}
            >
              {t('signInWithMetaMask') || 'Sign in with MetaMask'}
            </ProviderButton>
          </motion.div>
        </form>

        <motion.div
          variants={itemVariants}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          {t('loginDisclaimer') || 'By signing in, you agree to our terms of service'}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * LoginForm component
 * Modern React 19 implementation with Server Actions for OAuth provider selection
 * 
 * Features:
 * - useActionState() for authentication state management
 * - useFormStatus() for automatic loading states on provider buttons
 * - Server Actions for OAuth provider handling
 * - Progressive enhancement (works without JavaScript)
 * - Automatic redirect handling
 * - Enhanced error and success messaging
 * 
 * @param {LoginFormProps} props - Component props
 * @returns JSX.Element
 */
export default function LoginForm({ from }: LoginFormProps) {
  const { t } = useTranslation()
  const { data: session, status } = useSession()
  const router = useRouter()

  // Handle already authenticated users
  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(DEFAULT_LOCALE))
    }
  }, [status, router, from])

  // Loading state
  if (status === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center w-full h-full"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-lg font-medium"
        >
          {t('loading') || 'Loading...'}
        </motion.div>
      </motion.div>
    )
  }

  // Don't render if already authenticated
  if (status === 'authenticated') {
    return null
  }

  return <LoginFormContent from={from} />
} 