'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { useConnection, useDisconnect, useSignMessage } from 'wagmi'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { ConnectorPickerDialog } from '@/components/web3/connector-picker-dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, Wallet, ExternalLink } from 'lucide-react'
import { shortenAddress } from '@/features/evm/utils'
import CryptoOnboardingForm from '@/features/auth/components/crypto-onboarding-form'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  getMetaMaskDappDeepLink,
  hasInjectedProvider,
} from '@/lib/web3/connector-display'

export interface WalletConnectAuthProps {
  locale: Locale
  from?: string
}

export function WalletConnectAuth({ locale, from }: WalletConnectAuthProps) {
  const t = useTranslations('modules.auth.walletConnect')
  const tPicker = useTranslations('modules.auth.walletConnect.picker')
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [injectedAvailable, setInjectedAvailable] = useState(false)
  const { data: session, status: sessionStatus } = useSession()
  const { address, isConnected } = useConnection()
  const disconnect = useDisconnect()
  const signMessage = useSignMessage()
  const [connectOpen, setConnectOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const redirectStarted = useRef(false)

  const redirectTarget = from || ROUTES.PROFILE(locale)

  useEffect(() => {
    setInjectedAvailable(hasInjectedProvider())
  }, [])

  const handleSignInWithWallet = useCallback(async () => {
    if (!address || !isConnected) {
      setError(t('errors.notConnected'))
      return
    }

    setIsSigningIn(true)
    setError(null)

    try {
      const nonceRes = await fetch('/api/auth/crypto/generateNonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicAddress: address }),
      })

      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => ({}))
        throw new Error(body.error || t('errors.nonceFailed'))
      }

      const { nonce } = (await nonceRes.json()) as { nonce: string; expires: number }
      if (!nonce) {
        throw new Error(t('errors.nonceFailed'))
      }

      const signedNonce = await signMessage.signMessageAsync({
        account: address,
        message: nonce,
      })

      const result = await signIn('crypto-wallet', {
        walletAddress: address,
        signedNonce,
        redirect: false,
      })

      if (result?.error) {
        throw new Error(t('errors.signInFailed'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.signInFailed')
      if (
        message.toLowerCase().includes('reject') ||
        message.toLowerCase().includes('denied') ||
        (err as { code?: number })?.code === 4001
      ) {
        setError(t('errors.rejected'))
      } else {
        setError(message)
      }
    } finally {
      setIsSigningIn(false)
    }
  }, [address, isConnected, signMessage, t])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user) return
    if (session.user.needsOnboarding) return
    if (redirectStarted.current) return
    redirectStarted.current = true
    router.replace(redirectTarget)
  }, [sessionStatus, session, router, redirectTarget])

  const handleOnboardingComplete = useCallback(async () => {
    redirectStarted.current = true
    router.replace(redirectTarget)
  }, [router, redirectTarget])

  const showOpenInMetaMask = isMobile && !injectedAvailable && !isConnected

  if (sessionStatus === 'authenticated' && session?.user?.needsOnboarding) {
    return (
      <div className="w-full max-w-md mx-auto">
        <CryptoOnboardingForm onComplete={handleOnboardingComplete} />
      </div>
    )
  }

  if (sessionStatus === 'authenticated' && !session?.user?.needsOnboarding) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('redirecting')}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 px-1 sm:px-0">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('errors.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium">{isConnected ? t('connected') : t('notConnected')}</p>
            {isConnected && address ? (
              <p className="text-sm text-muted-foreground font-mono truncate">{shortenAddress(address)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isMobile ? tPicker('description') : t('connectHint')}
              </p>
            )}
          </div>
        </div>

        {!isConnected ? (
          <>
            <Button type="button" className="w-full" size="lg" onClick={() => setConnectOpen(true)}>
              {t('connectCta')}
            </Button>

            {showOpenInMetaMask ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                size="lg"
                asChild
              >
                <a
                  href={getMetaMaskDappDeepLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  {tPicker('openInMetaMask')}
                </a>
              </Button>
            ) : null}

            <ConnectorPickerDialog open={connectOpen} onOpenChange={setConnectOpen} />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={isSigningIn || signMessage.isPending}
              onClick={() => void handleSignInWithWallet()}
            >
              {isSigningIn || signMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('signingIn')}
                </>
              ) : (
                t('signInCta')
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              {t('disconnect')}
            </Button>
          </div>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-4 hover:text-foreground"
          onClick={() => router.push(ROUTES.LOGIN(locale))}
        >
          {t('backToLogin')}
        </button>
      </p>
    </div>
  )
}
