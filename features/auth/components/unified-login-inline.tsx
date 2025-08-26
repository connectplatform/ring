'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
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

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

// Add type declaration for ethereum
declare global {
  interface Window {
    ethereum?: any
  }
}

/**
 * unified-login-inline props
 * @interface UnifiedLoginInlineProps
 * @property {string} [from] - The route to redirect to after successful login
 * @property {string} [variant] - The variant of the component ('default' | 'hero')
 */
interface UnifiedLoginInlineProps {
  from?: string
  variant?: 'default' | 'hero'
}

/**
 * unified-login-inline component - inline version without dialog wrapper
 * 
 * @param {UnifiedLoginInlineProps} props - Component props
 * @returns {React.ReactElement} The unified-login-inline component
 */
const UnifiedLoginInline: React.FC<UnifiedLoginInlineProps> = ({ from, variant = 'default' }) => {
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
    if (status === 'authenticated') {
      router.replace(from || ROUTES.PROFILE(locale))
    }
  }, [status, router, from, locale])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

  /**
   * Handles sign-in errors
   * @param {Error} error - The error object
   */
  const handleSignInError = (error: Error) => {
    console.error('Error signing in:', error)
    setError(tAuth('errors.signIn'))
  }

  /**
   * Handles magic link email authentication
   * @param {React.FormEvent} e - Form event
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError(tAuth('errors.emailRequired'))
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('resend', { 
        email: email.trim(),
        redirect: false,
        callbackUrl: from || ROUTES.PROFILE(locale)
      })
      
      if (result?.error) {
        throw new Error(result.error)
      }
      
      // Magic link sent successfully
      setEmailSent(true)
    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handles sign-in for Google and Apple
   * @param {string} provider - The provider to sign in with ('google' or 'apple')
   */
  const handleSignIn = async (provider: string) => {
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
  }

  const AnimatedLoginContainer = dynamic(() => import('./animated-login-content').then(m => m.AnimatedLoginContainer), { ssr: false })
  const AnimatedItem = dynamic(() => import('./animated-login-content').then(m => m.AnimatedItem), { ssr: false })

  if (variant === 'hero') {
    return (
      <div className="w-full max-w-md mx-auto">
        <AnimatedLoginContainer>
          {emailSent ? (
            <AnimatedItem>
              <div className="text-center py-8">
                <HiMail className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{tAuth('signIn.magicLink.sent')}</h3>
                <p className="text-muted-foreground mb-4">
                  {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEmailSent(false)
                    setEmail('')
                  }}
                  className="w-full"
                >
                  {tAuth('signIn.magicLink.useDifferent')}
                </Button>
              </div>
            </AnimatedItem>
          ) : (
            <AnimatedItem>
              <div className="space-y-4">
                {/* Email Input Form - Only show if Resend provider is available */}
                {providers?.resend && (
                  <>
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

                    {/* Alternative Login Options */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-muted"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-background px-4 text-muted-foreground">OR</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Google Sign-in (Preferred) */}
                <Button
                  onClick={() => handleSignIn('google')}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 border-gray-300"
                >
                  <FcGoogle className="mr-3 h-5 w-5" />
                  {tAuth('signIn.providers.google')}
                </Button>

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

                {/* Terms and Privacy */}
                <p className="text-xs text-center text-muted-foreground mt-6">
                  {tAuth('signIn.disclaimer')}
                </p>
              </div>
            </AnimatedItem>
          )}

          {error && (
            <AnimatedItem style={{ marginTop: '1.5rem' }}>
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            </AnimatedItem>
          )}
        </AnimatedLoginContainer>
      </div>
    )
  }

  // Default variant (compact)
  return (
    <div className="w-full">
      <AnimatedLoginContainer>
        {emailSent ? (
          <AnimatedItem>
            <div className="text-center py-6">
              <HiMail className="mx-auto h-10 w-10 text-green-500 mb-3" />
              <h3 className="text-base font-semibold mb-2">{tAuth('signIn.magicLink.sent')}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setEmailSent(false)
                  setEmail('')
                }}
                className="w-full"
                size="sm"
              >
                {tAuth('signIn.magicLink.useDifferent')}
              </Button>
            </div>
          </AnimatedItem>
        ) : (
          <AnimatedItem>
            <div className="space-y-3">
              {/* Email Input Form - Only show if Resend provider is available */}
              {providers?.resend && (
                <>
                  <form onSubmit={handleEmailSignIn} className="space-y-3">
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder={tAuth('signIn.emailPlaceholder')}
                        value={email}
                        onChange={handleEmailChange}
                        disabled={isLoading}
                        className="w-full h-10 pl-4 pr-10 text-sm"
                        required
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <HiMail className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="w-full h-10 bg-green-500 hover:bg-green-600 text-white font-medium text-sm"
                    >
                      {isLoading ? tAuth('signIn.loading') : tAuth('signIn.providers.email')}
                    </Button>
                  </form>

                  {/* Alternative Login Options */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-muted"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-3 text-muted-foreground">OR</span>
                    </div>
                  </div>
                </>
              )}

              {/* Google Sign-in (Preferred) */}
              <Button
                onClick={() => handleSignIn('google')}
                disabled={isLoading}
                variant="outline"
                className="w-full h-10 text-sm font-medium bg-white hover:bg-gray-50 border-gray-300"
              >
                <FcGoogle className="mr-2 h-4 w-4" />
                {tAuth('signIn.providers.google')}
              </Button>

              {/* Secondary Options Row */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleSignIn('apple')}
                  disabled={isLoading}
                  variant="outline"
                  className="h-10 text-xs font-medium"
                >
                  <AiFillApple className="mr-1 h-4 w-4" />
                  {tAuth('signIn.providers.apple')}
                </Button>
                <Button
                  onClick={handleCryptoLogin}
                  disabled={isLoading}
                  variant="outline"
                  className="h-10 text-xs font-medium"
                >
                  <FaEthereum className="mr-1 h-4 w-4" />
                  {tAuth('signIn.providers.metamask')}
                </Button>
              </div>

              {/* Terms and Privacy */}
              <p className="text-xs text-center text-muted-foreground mt-4">
                {tAuth('signIn.disclaimer')}
              </p>
            </div>
          </AnimatedItem>
        )}

        {error && (
          <AnimatedItem style={{ marginTop: '1rem' }}>
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          </AnimatedItem>
        )}
      </AnimatedLoginContainer>
    </div>
  )
}

export default UnifiedLoginInline
