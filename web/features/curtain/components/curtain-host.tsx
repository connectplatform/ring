'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { FsModal } from '@/components/ui/fs-modal'
import { Button } from '@/components/ui/button'
import { useOptionalStore } from '@/features/store/context'
import { useCallSession } from '@/features/chat/providers/call-session-provider'
import { usePeerGameBusy } from '@/features/peer-games/lib/peer-game-mutex'
import { isIosSafari, isStandaloneDisplay } from '@/lib/browser/pwa-display'
import { getClientMainCurrency } from '@/lib/ring-config-client'
import {
  CURTAIN_COMMISSION_DEFAULT,
  CURTAIN_DROP_EVENT,
  CURTAIN_EVENT_TYPES,
  CURTAIN_PAGE_EVENT,
  CURTAIN_PAGE_GATE_MS,
  CURTAIN_SCROLL_STOP_MS,
} from '@/features/curtain/constants'
import { CurtainBanner } from '@/features/curtain/components/curtain-banner'
import { loadServerCurtainPrefs, requestCurtainDrop, syncCurtainPrefs } from '@/features/curtain/actions'
import {
  applyNotForMe,
  applyNotToday,
  canShowOffer,
  recordImpression,
} from '@/features/curtain/lib/frequency'
import { pauseCurtainForRealtime, pathMayHavePageAuthor, shouldSkipCurtainPath } from '@/features/curtain/lib/eligibility'
import {
  mergeCurtainTouch,
  readCurtainAttributionClient,
  writeCurtainAttributionClient,
} from '@/features/curtain/lib/attribution-storage'
import {
  mergeCurtainPrefs,
  patchOfferPref,
  readCurtainPrefsClient,
  writeCurtainPrefsClient,
} from '@/features/curtain/lib/prefs-storage'
import type { CurtainDropParams, CurtainResponseType } from '@/features/curtain/types'
import type { StoreProduct } from '@/features/store/types'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function trackCurtain(event: string, data: Record<string, unknown>) {
  window.ringAnalytics?.track(event, data)
}

export function CurtainHost() {
  const t = useTranslations('modules.curtain')
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [page, setPage] = useState<{ authorUserId?: string; pageKind?: string }>({})
  const [pageGateOpen, setPageGateOpen] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)
  const store = useOptionalStore()
  const { session: callSession } = useCallSession()
  const gameBusy = usePeerGameBusy()
  const callBusy = callSession.phase !== 'idle'
  const skipPath = shouldSkipCurtainPath(pathname)

  const [offer, setOffer] = useState<CurtainDropParams | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [iosInstallOpen, setIosInstallOpen] = useState(false)
  const [swipeHint, setSwipeHint] = useState<'not_today' | 'not_for_me' | null>(null)
  const shownAt = useRef<number>(0)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeOfferId = useRef<string | null>(null)
  const scrollAwaySent = useRef(false)

  const busy = pauseCurtainForRealtime({ callBusy, gameBusy })

  const drop = useCallback((next: CurtainDropParams) => {
    const prefs = readCurtainPrefsClient()
    if (!canShowOffer(prefs.offers[next.offerId])) return
    const sameOffer = activeOfferId.current === next.offerId
    if (!sameOffer) {
      if (activeOfferId.current) {
        trackCurtain(CURTAIN_EVENT_TYPES.response, {
          offerId: activeOfferId.current,
          response: 'replaced' satisfies CurtainResponseType,
        })
      }
      const patched = patchOfferPref(prefs, next.offerId, recordImpression(prefs.offers[next.offerId]))
      writeCurtainPrefsClient(patched)
      if (session?.user?.id) void syncCurtainPrefs(patched)
      activeOfferId.current = next.offerId
      shownAt.current = Date.now()
      scrollAwaySent.current = false
      trackCurtain(CURTAIN_EVENT_TYPES.shown, { offerId: next.offerId, kind: next.kind })
    }
    setOffer(next)
    setVisible(true)
    setSwipeHint(null)
  }, [session?.user?.id])

  const hide = useCallback((response: CurtainResponseType) => {
    const current = offer
    setVisible(false)
    if (!current) return
    const visibleMs = Date.now() - shownAt.current
    trackCurtain(CURTAIN_EVENT_TYPES.response, {
      offerId: current.offerId,
      response,
      visibleMs,
      kind: current.kind,
    })
    if (response === 'cta') {
      trackCurtain(CURTAIN_EVENT_TYPES.cta, { offerId: current.offerId, kind: current.kind })
    }
  }, [offer])

  const suppress = useCallback((mode: 'not_today' | 'not_for_me') => {
    if (!offer) return
    const prefs = readCurtainPrefsClient()
    const nextPref = mode === 'not_for_me'
      ? applyNotForMe(prefs.offers[offer.offerId])
      : applyNotToday(prefs.offers[offer.offerId])
    const patched = patchOfferPref(prefs, offer.offerId, nextPref)
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
    trackCurtain(CURTAIN_EVENT_TYPES.suppress, { offerId: offer.offerId, mode })
    hide(mode)
    setDismissOpen(false)
    window.setTimeout(() => {
      if (activeOfferId.current === offer.offerId) {
        setOffer(null)
        activeOfferId.current = null
      }
    }, 400)
  }, [hide, offer, session?.user?.id])

  const onCta = useCallback(async () => {
    if (!offer) return
    if (offer.kind === 'product' && offer.productId) {
      const touches = mergeCurtainTouch(readCurtainAttributionClient(), {
        offerId: offer.offerId,
        productId: offer.productId,
        authorUserId: offer.authorUserId || page.authorUserId,
        pagePath: offer.pagePath || pathname,
        commissionPercent: offer.commissionPercent || CURTAIN_COMMISSION_DEFAULT,
        ctaAt: Date.now(),
      })
      writeCurtainAttributionClient(touches)
      if (store && offer.productName && offer.productPrice != null) {
        store.addToCart({
          id: offer.productId,
          name: offer.productName,
          price: String(offer.productPrice),
          currency: (offer.productCurrency || getClientMainCurrency()) as StoreProduct['currency'],
          inStock: true,
          images: offer.mediaUrl ? [offer.mediaUrl] : [],
        })
      } else if (offer.ctaHref) {
        window.location.assign(offer.ctaHref)
      }
    }
    if (offer.kind === 'a2hs') {
      const promptEvent = deferredPrompt.current
      if (promptEvent) {
        await promptEvent.prompt()
        deferredPrompt.current = null
      } else if (isIosSafari()) {
        setIosInstallOpen(true)
        return
      }
    }
    hide('cta')
    const prefs = readCurtainPrefsClient()
    const patched = patchOfferPref(prefs, offer.offerId, applyNotToday(prefs.offers[offer.offerId]))
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
  }, [hide, offer, page.authorUserId, pathname, session?.user?.id, store])

  const finishIosInstall = useCallback(() => {
    setIosInstallOpen(false)
    if (!offer) return
    hide('cta')
    const prefs = readCurtainPrefsClient()
    const patched = patchOfferPref(prefs, offer.offerId, applyNotToday(prefs.offers[offer.offerId]))
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
  }, [hide, offer, session?.user?.id])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  useEffect(() => {
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<CurtainDropParams>).detail
      if (detail?.offerId) drop(detail)
    }
    window.addEventListener(CURTAIN_DROP_EVENT, onCustom as EventListener)
    return () => window.removeEventListener(CURTAIN_DROP_EVENT, onCustom as EventListener)
  }, [drop])

  useEffect(() => {
    const onPage = (event: Event) => {
      const detail = (event as CustomEvent<{ authorUserId?: string; pageKind?: string }>).detail || {}
      setPage({ authorUserId: detail.authorUserId, pageKind: detail.pageKind })
      if (detail.authorUserId) setPageGateOpen(true)
    }
    window.addEventListener(CURTAIN_PAGE_EVENT, onPage as EventListener)
    return () => window.removeEventListener(CURTAIN_PAGE_EVENT, onPage as EventListener)
  }, [])

  useEffect(() => {
    setPageGateOpen(false)
    setPage({})
    const wait = pathMayHavePageAuthor(pathname) ? CURTAIN_PAGE_GATE_MS + 800 : CURTAIN_PAGE_GATE_MS
    const timer = window.setTimeout(() => setPageGateOpen(true), wait)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    if (status === 'loading') return
    if (status !== 'authenticated') {
      setPrefsReady(true)
      return
    }
    setPrefsReady(false)
    void loadServerCurtainPrefs()
      .then((remote) => {
        if (cancelled) return
        const merged = mergeCurtainPrefs(readCurtainPrefsClient(), remote)
        writeCurtainPrefsClient(merged)
        return syncCurtainPrefs(merged)
      })
      .then(() => {
        if (!cancelled) setPrefsReady(true)
      })
      .catch(() => {
        if (!cancelled) setPrefsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    if (skipPath) {
      setVisible(false)
      setOffer(null)
      activeOfferId.current = null
      return
    }
    if (!pageGateOpen || !prefsReady) return
    let cancelled = false
    void requestCurtainDrop({
      pathname,
      isStandalone: isStandaloneDisplay(),
      authorUserId: page.authorUserId,
    }).then((next) => {
      if (cancelled || !next) return
      drop(next)
    })
    return () => {
      cancelled = true
    }
  }, [drop, page.authorUserId, pageGateOpen, pathname, prefsReady, skipPath])

  useEffect(() => {
    const onScroll = () => {
      if (!offer || busy || skipPath) return
      if (visible && !scrollAwaySent.current) {
        scrollAwaySent.current = true
        trackCurtain(CURTAIN_EVENT_TYPES.response, {
          offerId: offer.offerId,
          response: 'scroll_away' satisfies CurtainResponseType,
          kind: offer.kind,
        })
      }
      setVisible(false)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        const prefs = readCurtainPrefsClient()
        if (!canShowOffer(prefs.offers[offer.offerId])) return
        setVisible(true)
        shownAt.current = Date.now()
        scrollAwaySent.current = false
        trackCurtain(CURTAIN_EVENT_TYPES.shown, {
          offerId: offer.offerId,
          kind: offer.kind,
          resurface: true,
        })
      }, CURTAIN_SCROLL_STOP_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [busy, offer, skipPath, visible])

  const bannerVisible = Boolean(offer) && visible && !busy && !skipPath

  return (
    <>
      {offer ? (
        <CurtainBanner
          offer={{
            ...offer,
            line2:
              offer.kind === 'a2hs' && isIosSafari()
                ? { text: t('a2hsLine2Ios') }
                : offer.line2,
            ctaText:
              offer.kind === 'a2hs' && isIosSafari() && !deferredPrompt.current
                ? t('a2hsCtaIos')
                : offer.ctaText,
          }}
          visible={bannerVisible}
          swipeHint={swipeHint}
          onCta={() => void onCta()}
          onDesktopDismiss={() => setDismissOpen(true)}
          onSwipe={(direction) => {
            setSwipeHint(direction === 'right' ? 'not_today' : 'not_for_me')
            window.setTimeout(() => {
              suppress(direction === 'right' ? 'not_today' : 'not_for_me')
            }, 180)
          }}
        />
      ) : null}
      <FsModal
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        title={t('dismissTitle')}
        description={t('dismissBody')}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => suppress('not_today')}>
              {t('notToday')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => suppress('not_for_me')}>
              {t('notForMe')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">{t('dismissHelp')}</p>
      </FsModal>
      <FsModal
        open={iosInstallOpen}
        onOpenChange={setIosInstallOpen}
        title={t('iosInstallTitle')}
        description={t('iosInstallBody')}
        footer={
          <Button type="button" onClick={finishIosInstall}>
            {t('iosInstallDone')}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">{t('iosInstallBody')}</p>
      </FsModal>
    </>
  )
}

export function curtainDrop(params: CurtainDropParams): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CURTAIN_DROP_EVENT, { detail: params }))
}
