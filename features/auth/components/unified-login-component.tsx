'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { useSession } from '@/components/providers/session-provider'
import authClient from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// Add type declaration for ethereum
declare global {
  interface Window {
    ethereum?: any
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
  const tAuth = useTranslations('modules.auth')
  const router = useRouter()
  const { data: session, status } = useSession()
  const locale = useLocale() as 'en' | 'uk'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Only handle redirect when the login dialog is open to avoid
    // unexpected redirects during normal navigation (e.g., language switch)
    if (!open) return
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(locale))
      onClose?.()
    }
  }, [status, router, from, onClose, open, locale])

  /**
   * Handles sign-in errors
   * @param {Error} error - The error object
   */
  const handleSignInError = (error: Error) => {
    console.error('Error signing in:', error)
    setError(tAuth('errors.signIn'))
  }

  /**
   * Handles sign-in for Google and Apple
   * @param {string} provider - The provider to sign in with ('google' or 'apple')
   */
  const handleSignIn = async (provider: string) => {
    setIsLoading(true)
    try {
      const result = await authClient.signIn.social({ 
        provider: provider as 'google' | 'apple',
        callbackURL: from || ROUTES.PROFILE(locale)
      })
      
      if (result.error) {
        throw new Error(result.error.message || 'Sign in failed')
      }
      
      // BetterAuth handles redirects differently, just refresh or redirect
      router.push(from || ROUTES.PROFILE(locale))
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
      const { nonce } = await nonceResponse.json()

      // Sign the nonce
      const signedNonce = await signer.signMessage(nonce)

      // Authenticate with BetterAuth
      // TODO: Implement crypto wallet authentication with BetterAuth
      // For now, show error that crypto wallet auth needs to be implemented
      throw new Error('Crypto wallet authentication is being migrated to BetterAuth and will be available soon.')

    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  const AnimatedLoginContainer = dynamic(() => import('./animated-login-content').then(m => m.AnimatedLoginContainer), { ssr: false })
  const AnimatedItem = dynamic(() => import('./animated-login-content').then(m => m.AnimatedItem), { ssr: false })

  return (
    <Dialog open={open} onOpenChange={onClose || (() => {})}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tAuth('signIn.title')}</DialogTitle>
        </DialogHeader>
          <AnimatedLoginContainer>
            <AnimatedItem
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
                {tAuth('signIn.providers.google')}
              </Button>
              <Button
                onClick={() => handleSignIn('apple')}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                <AiFillApple className="mr-2 h-5 w-5" />
                {tAuth('signIn.providers.apple')}
              </Button>
              <Button
                onClick={handleCryptoLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base font-medium"
              >
                <FaEthereum className="mr-2 h-5 w-5" />
                {tAuth('signIn.providers.wallet')}
              </Button>
            </AnimatedItem>
            {error && (
              <AnimatedItem style={{ marginTop: '1.5rem' }}>
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              </AnimatedItem>
            )}
          </AnimatedLoginContainer>
      </DialogContent>
    </Dialog>
  )
}

export default UnifiedLoginComponent
