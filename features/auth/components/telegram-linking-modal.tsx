'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FsModal } from '@/components/ui/fs-modal'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { signIn, useSession } from 'next-auth/react'
import type { Locale } from '@/i18n/shared'

interface TelegramLinkingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.064-1.226-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

/**
 * Telegram Account Linking Modal (FsModal)
 *
 * Primary: Auth.js Telegram OIDC (`signIn('telegram')`) after
 * POST /api/auth/telegram/link/prepare sets a signed link-intent cookie so the
 * OIDC callback attaches communication.telegramId to the current Ring user
 * (and awards `addedTelegram` once via syncUserTelegramCommunication).
 * Younger Telegram-OIDC-only shells merge into the linker (anti-hijack).
 *
 * Truth lens: telegram_login_widget_specialist + authjs_specialist
 */
export default function TelegramLinkingModal({
  open,
  onOpenChange,
}: TelegramLinkingModalProps) {
  const t = useTranslations('modules.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale() as Locale
  const { update: updateSession } = useSession()
  const [loading, setLoading] = useState(false)
  const [linked, setLinked] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setLoading(false)
    setLinked(false)
    setErrorCode(null)

    const params = new URLSearchParams(window.location.search)
    if (params.get('telegram') === 'linked') {
      setLinked(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('telegram')
      window.history.replaceState({}, '', url.toString())
      void updateSession()
      return
    }

    const error = params.get('error')
    if (
      error?.startsWith('telegram_') ||
      error === 'Configuration' ||
      error === 'OAuthCallback' ||
      error === 'AccessDenied'
    ) {
      setErrorCode(error)
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [open, updateSession])

  useEffect(() => {
    if (!open) return

    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('telegram') === 'linked') {
        setLinked(true)
        setLoading(false)
        void updateSession()
        router.refresh()
        const url = new URL(window.location.href)
        url.searchParams.delete('telegram')
        window.history.replaceState({}, '', url.toString())
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkUrl()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', checkUrl)
    checkUrl()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkUrl)
    }
  }, [open, updateSession, router])

  const startOidcLink = async () => {
    if (loading) return
    setLoading(true)
    setErrorCode(null)
    try {
      const prep = await fetch('/api/auth/telegram/link/prepare', {
        method: 'POST',
        credentials: 'include',
      })
      if (prep.status === 401) {
        setErrorCode('telegram_auth_required')
        setLoading(false)
        return
      }
      if (!prep.ok) {
        setErrorCode('telegram_server_error')
        setLoading(false)
        return
      }
      const callbackUrl = `/${locale}/profile?telegram=linked`
      await signIn('telegram', { callbackUrl })
    } catch (e) {
      console.error('Telegram OIDC link error:', e)
      setErrorCode('telegram_server_error')
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (linked) router.refresh()
      onOpenChange(false)
    } else {
      onOpenChange(true)
    }
  }

  const errorMessage = (() => {
    switch (errorCode) {
      case 'telegram_auth_required':
        return t('linkTelegramErrorAuthRequired')
      case 'telegram_already_linked':
      case 'AccessDenied':
        return t('linkTelegramErrorAlreadyLinked')
      case 'telegram_server_error':
        return t('linkTelegramErrorServer')
      case 'Configuration':
      case 'OAuthCallback':
        return t('linkTelegramErrorMisconfigured')
      default:
        return errorCode
    }
  })()

  return (
    <FsModal
      open={open}
      onOpenChange={handleOpenChange}
      title={t('addTelegramAccount')}
      hideHeaderSeparator
      className="max-sm:pt-0"
      contentClassName="flex flex-col p-0 sm:px-0"
    >
      <div className="relative mx-auto w-full min-h-[min(72dvh,560px)] flex-1">
        {linked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-green-600">{t('telegramConnected')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t('linkTelegramSuccessDetail')}
            </p>
            <Button
              onClick={() => handleOpenChange(false)}
              className="mt-2 w-full max-w-sm"
            >
              {tCommon('actions.continue')}
            </Button>
          </div>
        ) : (
          <>
            {/* Logo + copy sit above the vertical midpoint */}
            <div className="absolute inset-x-0 bottom-[calc(50%+2.75rem)] flex flex-col items-center gap-3 px-6">
              <div className="flex w-[30%] max-w-[9rem] min-w-[4.5rem] aspect-square items-center justify-center text-[#229ED9]">
                <TelegramGlyph className="h-full w-full" />
              </div>
              {errorCode ? (
                <div className="flex max-w-sm flex-col items-center gap-2 text-center text-sm text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p>{errorMessage}</p>
                </div>
              ) : (
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  {t('linkTelegramDescription')}
                </p>
              )}
            </div>

            {/* Primary CTA centered in the widget */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6">
              <Button
                type="button"
                onClick={startOidcLink}
                disabled={loading}
                variant="default"
                className="w-full min-h-12 font-medium"
                aria-label={t('addTelegramAccount')}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <TelegramGlyph className="mr-2 h-5 w-5 shrink-0" />
                )}
                {t('addTelegramAccount')}
              </Button>
            </div>

            {/* Cancel directly under primary — no footer separator */}
            <div className="absolute inset-x-0 top-[calc(50%+2.75rem)] px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-full"
                disabled={loading}
              >
                {t('cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </FsModal>
  )
}
