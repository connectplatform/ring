'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, Variants, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { signIn, useSession } from 'next-auth/react'
import { ethers } from 'ethers'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// Add type declaration for ethereum
declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider
  }
}

/**
 * unified-login-component props
 * @interface unified-login-componentProps
 * @property {boolean} open - Whether the login dialog is open
 * @property {() => void} [onClose] - Function to close the login dialog (optional)
 * @property {string} [from] - The route to redirect to after successful login
 */
interface UnifiedLoginComponentProps {
  open: boolean
  onClose?: () => void
  from?: string
}

/**
 * unified-login-component combines functionality from Logindialog, LoginForm, and CryptoWalletLogin
 * 
 * User steps:
 * 1. User opens the login dialog
 * 2. User chooses a login method (Google, Apple, or Crypto Wallet)
 * 3. User completes the authentication process
 * 4. On successful login, user is redirected to the specified route or profile page
 * 
 * @param {unified-login-componentProps} props - Component props
 * @returns {React.ReactElement} The unified-login-component
 */
const UnifiedLoginComponent: React.FC<UnifiedLoginComponentProps> = ({ open, onClose, from }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(DEFAULT_LOCALE))
      onClose?.()
    }
  }, [status, router, from, onClose])

  /**
   * Handles sign-in errors
   * @param {Error} error - The error object
   */
  const handleSignInError = (error: Error) => {
    console.error('Error signing in:', error)
    setError(t('errorSigningIn'))
  }

  /**
   * Handles sign-in for Google and Apple
   * @param {string} provider - The provider to sign in with ('google' or 'apple')
   */
  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    try {
      const result = await signIn(provider, { redirect: false, callbackUrl: from || ROUTES.PROFILE(DEFAULT_LOCALE) })
      if (result?.error) {
        throw new Error(result.error)
      }
      if (result?.url) {
        router.push(result.url)
      }
    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handles sign-in with Crypto Wallet (MetaMask)
   */
  const handleCryptoLogin = async () => {
    setIsLoading(true)
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Please install MetaMask to use this feature')
      }

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
      const { nonce } = await nonceResponse.json()

      // Sign the nonce
      const signedNonce = await signer.signMessage(nonce)

      // Authenticate with NextAuth
      const callbackUrl = from || ROUTES.PROFILE(DEFAULT_LOCALE)
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

    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
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

  return (
    <Dialog open={open} onOpenChange={onClose || (() => {})}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('signIn')}</DialogTitle>
        </DialogHeader>
        <AnimatePresence>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <Button
                onClick={() => handleSignIn('google')}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                <FcGoogle className="mr-2 h-5 w-5" />
                {t('signInWithGoogle')}
              </Button>
              <Button
                onClick={() => handleSignIn('apple')}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                <AiFillApple className="mr-2 h-5 w-5" />
                {t('signInWithApple')}
              </Button>
              <Button
                onClick={handleCryptoLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                <FaEthereum className="mr-2 h-5 w-5" />
                {t('signInWithCryptoWallet')}
              </Button>
            </motion.div>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6"
                >
                  <Alert variant="destructive">
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

export default UnifiedLoginComponent
