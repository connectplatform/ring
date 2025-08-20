'use client'

import React, { useState } from 'react'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

interface LoginFormProps {
  from?: string
}

/**
 * LoginForm component
 * Modern React 19 implementation with client-side OAuth authentication
 * 
 * Features:
 * - Client-side OAuth authentication with next-auth/react
 * - Support for Google, Apple, and MetaMask providers
 * - Animated UI with Framer Motion
 * - Automatic redirect handling
 * - Enhanced error messaging
 * 
 * @param {LoginFormProps} props - Component props
 * @returns JSX.Element
 */
export default function LoginForm({ from }: LoginFormProps) {
  const tAuth = useTranslations('modules.auth')
  const tCommon = useTranslations('common')
  const { data: session, status } = useSession()
  const router = useRouter()
  const locale = useLocale() as 'en' | 'uk'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  // Handle already authenticated users
  React.useEffect(() => {
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(locale))
    }
  }, [status, router, from, locale])

  /**
   * Handles sign-in for OAuth providers (Google, Apple)
   */
  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setIsLoading(true)
    setLoadingProvider(provider)
    setError(null)
    
    try {
      const callbackUrl = from || ROUTES.PROFILE(locale)
      
      // Use client-side signIn for proper OAuth flow
      const result = await signIn(provider, { 
        redirect: false,
        callbackUrl 
      })
      
      if (result?.error) {
        // Handle specific Auth.js errors
        if (result.error === 'OAuthAccountNotLinked') {
          setError('Another account already exists with the same email address.')
        } else if (result.error === 'Configuration') {
          setError('There was a problem with the authentication configuration.')
        } else {
          setError(tAuth('errors.signIn'))
        }
      } else if (result?.url) {
        // Successful sign-in, redirect to the callback URL
        router.push(result.url)
      }
    } catch (error) {
      console.error('Error signing in:', error)
      setError(tAuth('errors.signIn'))
    } finally {
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  /**
   * Handles sign-in with Crypto Wallet (MetaMask)
   */
  const handleCryptoSignIn = async () => {
    setIsLoading(true)
    setLoadingProvider('metamask')
    setError(null)
    
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Please install MetaMask to use this feature')
      }

      const { ethers } = await import('ethers')
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const publicAddress = await signer.getAddress()

      // Generate nonce
      const nonceResponse = await fetch('/api/auth/crypto/generateNonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicAddress }),
      })
      
      if (!nonceResponse.ok) {
        throw new Error('Failed to generate nonce')
      }
      
      const { nonce } = await nonceResponse.json()

      // Sign the nonce
      const signedNonce = await signer.signMessage(nonce)

      // Authenticate with NextAuth
      const callbackUrl = from || ROUTES.PROFILE(locale)
      const result = await signIn('crypto-wallet', {
        publicAddress,
        signedNonce,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        throw new Error(result.error)
      }
      if (result?.url) {
        router.push(result.url)
      }
    } catch (error: any) {
      console.error('Crypto wallet sign-in error:', error)
      setError(error.message || tAuth('errors.signIn'))
    } finally {
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

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
          {tCommon('status.loading')}
        </motion.div>
      </motion.div>
    )
  }

  // Don't render if already authenticated
  if (status === 'authenticated') {
    return null
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
          {tAuth('signIn.title')}
        </motion.h1>

        {/* Show error message if any */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <motion.div variants={itemVariants}>
            <Button
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 text-base font-medium"
            >
              {loadingProvider === 'google' ? (
                <span className="animate-spin mr-2">⌛</span>
              ) : (
                <FcGoogle className="mr-2 h-5 w-5" />
              )}
              {loadingProvider === 'google' 
                ? (tAuth('signIn.loading')) 
                : (tAuth('signIn.providers.google'))}
            </Button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button
              onClick={() => handleOAuthSignIn('apple')}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 text-base font-medium"
            >
              {loadingProvider === 'apple' ? (
                <span className="animate-spin mr-2">⌛</span>
              ) : (
                <AiFillApple className="mr-2 h-5 w-5" />
              )}
              {loadingProvider === 'apple' 
                ? (tAuth('signIn.loading')) 
                : (tAuth('signIn.providers.apple'))}
            </Button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button
              onClick={handleCryptoSignIn}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 text-base font-medium"
            >
              {loadingProvider === 'metamask' ? (
                <span className="animate-spin mr-2">⌛</span>
              ) : (
                <FaEthereum className="mr-2 h-5 w-5" />
              )}
              {loadingProvider === 'metamask' 
                ? (tAuth('signIn.loading')) 
                : (tAuth('signIn.providers.metamask'))}
            </Button>
          </motion.div>
        </div>

        <motion.div
          variants={itemVariants}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          {tAuth('signIn.disclaimer')}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}