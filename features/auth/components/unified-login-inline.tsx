'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import { AiFillApple } from 'react-icons/ai'
import { FaEthereum } from 'react-icons/fa'
import { HiMail } from 'react-icons/hi'
import { signIn, getProviders } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle } from '@/components/ui/alert'
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
  const locale = useLocale() as 'en' | 'uk'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [providers, setProviders] = useState<any>(null)
  const [isAuthInProgress, setIsAuthInProgress] = useState(false)
  
  // Check available providers
  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders()
      setProviders(res)
    }
    fetchProviders()
  }, [])


  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    // Clear any previous errors when user starts typing
    if (error) {
      setError(null)
    }
  }, [error])

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
   * @param {React.FormEvent<HTMLFormElement>} e - Form event
   */
  const handleEmailSignIn = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Get email from form data for React 19 best practices
    const formData = new FormData(e.currentTarget)
    const formEmail = formData.get('email') as string

    if (!formEmail?.trim()) {
      setError(tAuth('errors.emailRequired'))
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('resend', {
        email: formEmail.trim(),
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
  }, [tAuth, from, locale, handleSignInError])

  /**
   * Handles sign-in for Apple and other OAuth providers
   * Redirects to OAuth provider URL which will complete auth callback
   * @param {string} provider - The provider to sign in with ('apple')
   */
  const handleSignIn = useCallback(async (provider: string) => {
    try {
      // For OAuth providers like Apple, pass the callback URL
      // Auth.js will handle redirect to provider, then callback will process the response
      const result = await signIn(provider, { 
        redirect: false,
        callbackUrl: from || ROUTES.PROFILE(locale)
      })
      
      if (result?.error) {
        console.error(`${provider} sign-in error:`, result.error)
        setError(`Failed to sign in with ${provider}`)
        return
      }
      
      if (result?.url) {
        console.log(`Redirecting to ${provider} OAuth provider...`)
        // Redirect to OAuth provider - browser will handle the OAuth flow
        // After user authenticates, provider redirects back to auth callback
        // Callback completes, session is established, and user is redirected to profile
        router.push(result.url)
      }
    } catch (error) {
      console.error(`${provider} sign-in error:`, error)
      setError(`Failed to sign in with ${provider}`)
    }
  }, [from, locale, router])

  /**
   * Handles sign-in with Crypto Wallet (MetaMask)
   */
  const handleCryptoLogin = useCallback(async () => {
    setIsLoading(true)
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Please install MetaMask to use this feature')
      }

      throw new Error('Web3 auth upgraded - please use the multi-chain wallet dashboard for connection')

    } catch (error) {
      handleSignInError(error as Error)
    } finally {
      setIsLoading(false)
    }
  }, [from, locale, router, handleSignInError])

  const handleUseDifferentEmail = useCallback(() => {
    setEmailSent(false)
    setEmail('')
  }, [])

  if (variant === 'hero') {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* Authentication In Progress Overlay */}
        {isAuthInProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-lg font-medium">{tAuth('signIn.loading')}</p>
            </div>
          </div>
        )}

        {/* Google One Tap - Disabled on login page to prevent unwanted popup */}
        {/* <GoogleOneTap redirectUrl={from || ROUTES.PROFILE(locale)} /> */}

        {emailSent ? (
          <div className="text-center py-8">
            <HiMail className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{tAuth('signIn.magicLink.sent')}</h3>
            <p className="text-muted-foreground mb-4">
              {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
            </p>
            <Button
              variant="outline"
              onClick={handleUseDifferentEmail}
              className="w-full"
            >
              {tAuth('signIn.magicLink.useDifferent')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Container for Google button spanning over secondary options */}
            <div className="relative">
              {/* Google Sign-in with GIS (No redirects!) - spans over both buttons below */}
              <div className="mb-4">
                <GoogleSignInButtonGIS
                  redirectUrl={from || ROUTES.PROFILE(locale)}
                  className="w-full"
                  variant="outline"
                  size="lg"
                  onAuthStart={() => {
                    setIsLoading(true)
                    setIsAuthInProgress(true)
                  }}
                  onAuthEnd={() => {
                    setIsLoading(false)
                    setIsAuthInProgress(false)
                  }}
                />
              </div>

              {/* Secondary Options Row - positioned below the Google button */}
              <div className="grid grid-cols-2 gap-3 -mt-2">
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
              <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder={tAuth('signIn.emailPlaceholder')}
                    value={email}
                    onChange={handleEmailChange}
                    disabled={isLoading}
                    className="w-full h-12 pl-4 pr-12 text-base"
                    required
                    autoComplete="email"
                    name="email"
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
            {tAuth('signIn.disclaimerPrefix')}{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              {tAuth('signIn.termsOfUse')}
            </a>
            {' '}{tAuth('signIn.and')}{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              {tAuth('signIn.privacyPolicy')}
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
    )
  }

  // Default variant (compact)
  return (
    <div className="w-full">
      {/* Authentication In Progress Overlay */}
      {isAuthInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-lg font-medium">{tAuth('signIn.loading')}</p>
          </div>
        </div>
      )}

      {/* Google One Tap - Automatically shows for signed-in Google users */}
      {/* <GoogleOneTap redirectUrl={from || ROUTES.PROFILE(locale)} /> */}

      {emailSent ? (
        <div className="text-center py-6">
          <HiMail className="mx-auto h-10 w-10 text-green-500 mb-3" />
          <h3 className="text-base font-semibold mb-2">{tAuth('signIn.magicLink.sent')}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {tAuth('signIn.magicLink.sentDescription')} <strong>{email}</strong>
          </p>
          <Button
            variant="outline"
            onClick={handleUseDifferentEmail}
            className="w-full"
            size="sm"
          >
            {tAuth('signIn.magicLink.useDifferent')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Google Sign-in with GIS (No redirects!) */}
          <GoogleSignInButtonGIS
            redirectUrl={from || ROUTES.PROFILE(locale)}
            className="w-full"
            variant="outline"
            size="default"
            onAuthStart={() => {
              setIsLoading(true)
              setIsAuthInProgress(true)
            }}
            onAuthEnd={() => {
              setIsLoading(false)
              setIsAuthInProgress(false)
            }}
          />

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

          {/* Alternative Login Options */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-muted"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">OR</span>
            </div>
          </div>

          {/* Email Input Form - Only show if Resend provider is available */}
          {providers?.resend && (
            <form onSubmit={handleEmailSignIn} className="space-y-3" noValidate>
              <div className="relative">
                <Input
                  type="email"
                  placeholder={tAuth('signIn.emailPlaceholder')}
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  className="w-full h-10 pl-4 pr-10 text-sm"
                  required
                  autoComplete="email"
                  name="email"
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
          )}

          {/* Terms and Privacy */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            {tAuth('signIn.disclaimerPrefix')}{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              {tAuth('signIn.termsOfUse')}
            </a>
            {' '}{tAuth('signIn.and')}{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              {tAuth('signIn.privacyPolicy')}
            </a>.
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem' }}>
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        </div>
      )}
    </div>
  )
}

export default UnifiedLoginInline