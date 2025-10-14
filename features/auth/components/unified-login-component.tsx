'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { HiMail } from 'react-icons/hi'
import { signIn, useSession, getProviders } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GoogleOneTap } from './google-one-tap'
import GoogleSignInButtonGIS from './google-signin-button-gis'

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
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [providers, setProviders] = useState<any>(null)
  
  // Check available providers
  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders()
      setProviders(res)
    }
    fetchProviders()
  }, [])

  useEffect(() => {
    // Only handle redirect when the login dialog is open to avoid
    // unexpected redirects during normal navigation (e.g., language switch)
    if (!open) return
    
    // Only redirect if fully authenticated (not during magic link flow)
    if (status === 'authenticated' && !emailSent) {
      router.replace(from || ROUTES.PROFILE(locale))
      onClose?.()
    }
  }, [status, router, from, onClose, open, locale, emailSent])

  /**
   * Handles sign-in errors
   * @param {Error} error - The error object
   */
  const handleSignInError = useCallback((error: Error) => {
    console.error('Error signing in:', error)
    setError(tAuth('errors.signIn'))
  }, [tAuth])

  /**
   * Handles magic link email authentication
   * @param {React.FormEvent} e - Form event
   */
  const handleEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError(tAuth('errors.emailRequired'))
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      console.log('Attempting magic link sign-in with email:', email.trim())
      const result = await signIn('resend', { 
        email: email.trim(),
        redirect: false,
        callbackUrl: from || ROUTES.PROFILE(locale)
      })
      
      console.log('Magic link sign-in result:', result)
      
      if (result?.error) {
        console.error('Magic link sign-in error:', result.error)
        throw new Error(result.error)
      }
      
      // Magic link sent successfully
      console.log('Magic link sent successfully')
      setEmailSent(true)
    } catch (error) {
      console.error('Magic link sign-in failed:', error)
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [email, tAuth, from, locale, handleSignInError])

  /**
   * Handles sign-in for Google and Apple
   * @param {string} provider - The provider to sign in with ('google' or 'apple')
   */
  const handleSignIn = useCallback(async (provider: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn(provider, { redirect: false, callbackUrl: from || ROUTES.PROFILE(locale) })
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
  }, [from, locale, router, handleSignInError])

  /**
   * Handles sign-in with Crypto Wallet (MetaMask)
   */
  const handleCryptoLogin = useCallback(async () => {
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

    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [from, locale, router, handleSignInError])

  /**
   * Handles resetting email form
   */
  const handleResetEmail = useCallback(() => {
    setEmailSent(false)
    setEmail('')
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onClose || (() => {})}>
      <DialogContent className="sm:max-w-[425px] p-8">
        <DialogHeader className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
            <img
              src="/logo.svg"
              alt="Ring Logo"
              className="w-16 h-16"
            />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">{tAuth('signIn.title')}</DialogTitle>
          <p className="text-muted-foreground mt-2 text-center">{tAuth('signIn.subtitle')}</p>
        </DialogHeader>

        {/* Google One Tap - Disabled in favor of GIS button */}
        {/* <GoogleOneTap
          disabled={open}
          redirectUrl={from || ROUTES.PROFILE(locale)}
        /> */}

        <div className="space-y-4">
          {emailSent ? (
            <div className="text-center py-8">
                <HiMail className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{tAuth('signIn.magicLink.sent')}</h3>
                <p className="text-muted-foreground mb-4">
                  {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleResetEmail}
                  className="w-full"
                >
                  {tAuth('signIn.magicLink.useDifferent')}
                </Button>
              </div>
          ) : (
              <div className="space-y-4">
                {/* Google Sign-in with GIS (No redirects!) */}
                <GoogleSignInButtonGIS
                  redirectUrl={from || ROUTES.PROFILE(locale)}
                  className="w-full"
                  variant="outline"
                  size="lg"
                />

                {/* Secondary Options Row */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleSignIn('apple')}
                    disabled={isLoading}
                    variant="outline"
                    className="h-12 text-sm font-medium"
                  >
                    <AiFillApple className="mr-2 h-5 w-5" />
                    {tAuth('signIn.providers.apple')}
                  </Button>
                  <Button
                    onClick={handleCryptoLogin}
                    disabled={isLoading}
                    variant="outline"
                    className="h-12 text-sm font-medium"
                  >
                    <FaEthereum className="mr-2 h-5 w-5" />
                    {tAuth('signIn.providers.metamask')}
                  </Button>
                </div>

                {/* Alternative Login Options */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-background px-4 text-muted-foreground">OR</span>
                  </div>
                </div>

                {/* Email Input Form - Only show if Resend provider is available */}
                {providers?.resend && (
                  <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder={tAuth('signIn.emailPlaceholder')}
                        value={email}
                        onChange={handleEmailChange}
                        disabled={isLoading}
                        className="w-full h-12 pl-4 pr-12 text-base"
                        required
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <HiMail className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-medium"
                    >
                      {isLoading ? tAuth('signIn.loading') : tAuth('signIn.providers.email')}
                    </Button>
                  </form>
                )}

                {/* Terms and Privacy */}
                <p className="text-xs text-center text-muted-foreground mt-6">
                  By continuing, you agree to our{' '}
                  <a href="/terms" className="text-blue-600 hover:underline">
                    Terms of Use
                  </a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>.
                </p>
              </div>
          )}

          {error && (
            <div style={{ marginTop: '1.5rem' }}>
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UnifiedLoginComponent