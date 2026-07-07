'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Send, Loader2, ExternalLink, CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface TelegramLinkingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Telegram Account Linking Modal
 * 
 * Uses the Telegram Login Widget (redirect mode) to link a Telegram
 * account to the user's Ring profile.
 * 
 * Flow:
 * 1. User clicks "Link Telegram Account" in the Messengers tab
 * 2. Modal shows the Telegram Login Widget button
 * 3. User authorizes → redirects to /api/auth/telegram/callback
 * 4. Callback validates hash, saves Telegram ID to user profile
 * 5. User is redirected back to /profile with success param
 */
export default function TelegramLinkingModal({
  open,
  onOpenChange,
}: TelegramLinkingModalProps) {
  const t = useTranslations('modules.profile')
  const router = useRouter()
  const { update: updateSession } = useSession()
  const widgetContainerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [linked, setLinked] = useState(false)

  // Determine callback URL from current origin
  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/telegram/callback`
    : ''

  // Load Telegram widget script when modal opens
  useEffect(() => {
    if (!open) return

    setLoading(true)
    setLinked(false)

    // Check if URL has success param
    const params = new URLSearchParams(window.location.search)
    if (params.get('telegram') === 'linked') {
      setLinked(true)
      setLoading(false)
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('telegram')
      window.history.replaceState({}, '', url.toString())
      updateSession()
      return
    }

    // Check for error params
    const error = params.get('error')
    if (error?.startsWith('telegram_')) {
      setLoading(false)
    }

    // Load Telegram widget script
    const loadWidget = () => {
      if (typeof window !== 'undefined' && (window as any).TelegramLoginWidget) {
        setScriptLoaded(true)
        setLoading(false)
        return
      }

      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.async = true
      script.onload = () => {
        setScriptLoaded(true)
        setLoading(false)
      }
      script.onerror = () => {
        setLoading(false)
      }
      document.body.appendChild(script)
    }

    // Small delay to ensure DOM is ready for widget placement
    const timer = setTimeout(loadWidget, 100)
    return () => clearTimeout(timer)
  }, [open, updateSession])

  // Re-render widget when script loads and container is available
  useEffect(() => {
    if (!open || !scriptLoaded || !widgetContainerRef.current || linked) return

    // Clear container
    widgetContainerRef.current.innerHTML = ''

    // Create widget container element
    const widgetContainer = document.createElement('div')
    widgetContainer.setAttribute('data-telegram-login', 'ringdom_bot')
    widgetContainer.setAttribute('data-size', 'large')
    widgetContainer.setAttribute('data-auth-url', callbackUrl)
    widgetContainer.setAttribute('data-request-access', 'write')
    widgetContainer.setAttribute('data-lang', 'en')
    widgetContainerRef.current.appendChild(widgetContainer)

    // Notify Telegram widget script to process new element
    if ((window as any).TelegramLoginWidget) {
      (window as any).TelegramLoginWidget.render()
    }
  }, [open, scriptLoaded, callbackUrl, linked])

  // Check for success/error from URL when component mounts or focus returns
  useEffect(() => {
    if (!open) return

    const checkUrl = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('telegram') === 'linked') {
        setLinked(true)
        setLoading(false)
        updateSession()
        router.refresh()
        // Clean URL
        const url = new URL(window.location.href)
        url.searchParams.delete('telegram')
        window.history.replaceState({}, '', url.toString())
      }
    }

    // Check on visibility change (user returns from Telegram auth)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkUrl()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Also check on focus
    window.addEventListener('focus', checkUrl)

    checkUrl()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', checkUrl)
    }
  }, [open, updateSession, router])

  const handleClose = () => {
    if (linked) {
      router.refresh()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-sm:min-h-screen max-sm:rounded-none max-sm:pt-12">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            {t('addTelegramAccount')}
          </DialogTitle>
          <DialogDescription>
            {t('linkTelegramDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center gap-4 min-h-[180px] justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading Telegram widget...</p>
            </div>
          )}

          {linked && (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="font-medium text-green-600">{t('telegramConnected')}</p>
              <p className="text-sm text-muted-foreground">
                Your Telegram account has been linked successfully!
              </p>
            </div>
          )}

          {!loading && !linked && (
            <>
              {/* Telegram Login Widget renders here */}
              <div ref={widgetContainerRef} className="min-h-[60px] flex items-center justify-center" />

              {!scriptLoaded && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-muted-foreground">Could not load Telegram widget.</p>
                  <a
                    href={`https://t.me/ringdom_bot?start=auth_${Date.now()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Telegram directly
                  </a>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center max-w-sm">
                By linking your Telegram account, you authorize Ring Platform to send you
                notifications and manage your account via @ringdom_bot.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {linked ? (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              {t('continue') || 'Continue'}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              {t('cancel') || 'Cancel'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
