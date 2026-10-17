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
import { isIosBrowserTab, isIosSafari, isStandaloneDisplay } from '@/lib/browser/pwa-display'
import { isTelegramMiniAppShell } from '@/lib/browser/telegram-webapp'
import { getClientCurtainPolicy, getClientMainCurrency } from '@/lib/ring-config-client'
import {
  CURTAIN_DROP_EVENT,
  CURTAIN_EVENT_TYPES,
  CURTAIN_PAGE_EVENT,
  CURTAIN_PAGE_GATE_MS,
  CURTAIN_QUEUE_MAX,
  CURTAIN_SCROLL_STOP_MS,
} from '@/features/curtain/constants'
import { CurtainBanner } from '@/features/curtain/components/curtain-banner'
import { loadServerCurtainPrefs, requestCurtainDrop, syncCurtainPrefs } from '@/features/curtain/actions'
import { curtainEventPayload, trackCurtain } from '@/features/curtain/lib/analytics'
import { CURTAIN_COPY } from '@/features/curtain/lib/copy'
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

type InstallHelp = 'safari' | 'chrome' | null

function textOrFallback(
  t: { has: (key: string) => boolean; (key: string): string },
  key: keyof typeof CURTAIN_COPY,
): string {
  return t.has(key) ? t(key) : CURTAIN_COPY[key]
}

function withoutA2hsOnTelegram(offers: CurtainDropParams[]): CurtainDropParams[] {
  if (!isTelegramMiniAppShell()) return offers
  return offers.filter((offer) => offer.kind !== 'a2hs')
}

export function CurtainHost() {
  const t = useTranslations('modules.curtain')
  const pathname = usePathname()
  const policy = getClientCurtainPolicy()
  const { data: session, status } = useSession()
  const [page, setPage] = useState<{ newsArticleId?: string; pageKind?: string }>({})
  const [pageGateOpen, setPageGateOpen] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)
  const store = useOptionalStore()
  const { session: callSession } = useCallSession()
  const gameBusy = usePeerGameBusy()
  const callBusy = callSession.phase !== 'idle'
  const skipPath = shouldSkipCurtainPath(pathname)

  const [queue, setQueue] = useState<CurtainDropParams[]>([])
  const [visible, setVisible] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [installHelp, setInstallHelp] = useState<InstallHelp>(null)
  const [swipeHint, setSwipeHint] = useState<'not_today' | 'not_for_me' | null>(null)
  const shownAt = useRef<number>(0)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counted = useRef<Set<string>>(new Set())
  const scrollAwaySent = useRef(false)
  const offer = queue[0] ?? null
  const nextOffer = queue[1] ?? null

  const busy = pauseCurtainForRealtime({ callBusy, gameBusy })

  const noteImpression = useCallback((next: CurtainDropParams) => {
    if (counted.current.has(next.offerId)) return
    counted.current.add(next.offerId)
    const prefs = readCurtainPrefsClient()
    if (!canShowOffer(prefs.offers[next.offerId], Date.now(), policy.maxImpressionsPerDay)) return
    const patched = patchOfferPref(prefs, next.offerId, recordImpression(prefs.offers[next.offerId]))
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
    shownAt.current = Date.now()
    scrollAwaySent.current = false
    trackCurtain(CURTAIN_EVENT_TYPES.shown, curtainEventPayload(next))
  }, [policy.maxImpressionsPerDay, session?.user?.id])

  const enqueue = useCallback((incoming: CurtainDropParams[]) => {
    const prefs = readCurtainPrefsClient()
    const now = Date.now()
    const filtered = withoutA2hsOnTelegram(incoming).filter((offerRow) =>
      canShowOffer(prefs.offers[offerRow.offerId], now, policy.maxImpressionsPerDay),
    )
    if (filtered.length === 0) return
    setQueue((current) => {
      const ids = new Set(current.map((item) => item.offerId))
      const next = [...current]
      for (const offerRow of filtered) {
        if (ids.has(offerRow.offerId) || next.length >= CURTAIN_QUEUE_MAX) continue
        ids.add(offerRow.offerId)
        next.push(offerRow)
      }
      return next.length === current.length ? current : next
    })
    setVisible(true)
  }, [policy.maxImpressionsPerDay])

  const hide = useCallback((response: CurtainResponseType) => {
    const current = offer
    setVisible(false)
    if (!current) return
    trackCurtain(
      CURTAIN_EVENT_TYPES.response,
      curtainEventPayload(current, { response, visibleMs: Date.now() - shownAt.current }),
    )
    if (response === 'cta') {
      trackCurtain(CURTAIN_EVENT_TYPES.cta, curtainEventPayload(current))
    }
  }, [offer])

  const promote = useCallback((offerId: string) => {
    window.setTimeout(() => {
      setQueue((current) => (current[0]?.offerId === offerId ? current.slice(1) : current))
      setVisible(true)
    }, 280)
  }, [])

  const suppress = useCallback((mode: 'not_today' | 'not_for_me') => {
    if (!offer) return
    const prefs = readCurtainPrefsClient()
    const nextPref = mode === 'not_for_me'
      ? applyNotForMe(prefs.offers[offer.offerId])
      : applyNotToday(prefs.offers[offer.offerId], Date.now(), policy.notTodayHours)
    const patched = patchOfferPref(prefs, offer.offerId, nextPref)
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
    trackCurtain(CURTAIN_EVENT_TYPES.suppress, curtainEventPayload(offer, { mode }))
    hide(mode)
    setDismissOpen(false)
    promote(offer.offerId)
  }, [hide, offer, policy.notTodayHours, promote, session?.user?.id])

  const finishInstallHelp = useCallback(() => {
    setInstallHelp(null)
    if (!offer) return
    hide('cta')
    const prefs = readCurtainPrefsClient()
    const patched = patchOfferPref(
      prefs,
      offer.offerId,
      applyNotToday(prefs.offers[offer.offerId], Date.now(), policy.notTodayHours),
    )
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
    promote(offer.offerId)
  }, [hide, offer, policy.notTodayHours, promote, session?.user?.id])

  const onCta = useCallback(async () => {
    if (!offer) return
    if (offer.kind === 'product' && offer.productId && offer.offerToken) {
      const touches = mergeCurtainTouch(readCurtainAttributionClient(), {
        offerId: offer.offerId,
        productId: offer.productId,
        pagePath: offer.pagePath || pathname,
        commissionPercent: 0,
        ctaAt: Date.now(),
        offerToken: offer.offerToken,
        newsArticleId: offer.newsArticleId,
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
        setInstallHelp('safari')
        return
      } else if (isIosBrowserTab()) {
        setInstallHelp('chrome')
        return
      }
    }
    hide('cta')
    const prefs = readCurtainPrefsClient()
    const patched = patchOfferPref(
      prefs,
      offer.offerId,
      applyNotToday(prefs.offers[offer.offerId], Date.now(), policy.notTodayHours),
    )
    writeCurtainPrefsClient(patched)
    if (session?.user?.id) void syncCurtainPrefs(patched)
    promote(offer.offerId)
  }, [hide, offer, pathname, policy.notTodayHours, promote, session?.user?.id, store])

  useEffect(() => {
    if (!offer || !visible || busy || skipPath) return
    noteImpression(offer)
  }, [busy, noteImpression, offer, skipPath, visible])

  useEffect(() => {
    counted.current.clear()
  }, [pathname])

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
      if (detail?.offerId) enqueue([detail])
    }
    window.addEventListener(CURTAIN_DROP_EVENT, onCustom as EventListener)
    return () => window.removeEventListener(CURTAIN_DROP_EVENT, onCustom as EventListener)
  }, [enqueue])

  useEffect(() => {
    const onPage = (event: Event) => {
      const detail = (event as CustomEvent<{ newsArticleId?: string; pageKind?: string }>).detail || {}
      setPage({ newsArticleId: detail.newsArticleId, pageKind: detail.pageKind })
      if (detail.newsArticleId) setPageGateOpen(true)
    }
    window.addEventListener(CURTAIN_PAGE_EVENT, onPage as EventListener)
    return () => window.removeEventListener(CURTAIN_PAGE_EVENT, onPage as EventListener)
  }, [])

  useEffect(() => {
    setPageGateOpen(false)
    setPage({})
    setQueue([])
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
    if (!policy.enabled || skipPath) {
      setVisible(false)
      setQueue([])
      return
    }
    if (!pageGateOpen || !prefsReady || queue.length > 0) return
    let cancelled = false
    void requestCurtainDrop({
      pathname,
      isStandalone: isStandaloneDisplay(),
      newsArticleId: page.newsArticleId,
    }).then((result) => {
      if (cancelled) return
      enqueue(result.offers)
    })
    return () => {
      cancelled = true
    }
  }, [enqueue, page.newsArticleId, pageGateOpen, pathname, policy.enabled, prefsReady, queue.length, skipPath])

  useEffect(() => {
    if (!policy.enabled || skipPath || !prefsReady || !pageGateOpen) return
    if (queue.length === 0 || queue.length >= CURTAIN_QUEUE_MAX) return
    let cancelled = false
    void requestCurtainDrop({
      pathname,
      isStandalone: isStandaloneDisplay(),
      newsArticleId: page.newsArticleId,
      excludeOfferIds: queue.map((item) => item.offerId),
    }).then((result) => {
      if (!cancelled) enqueue(result.offers)
    })
    return () => {
      cancelled = true
    }
  }, [enqueue, page.newsArticleId, pageGateOpen, pathname, policy.enabled, prefsReady, queue, skipPath])

  useEffect(() => {
    const onScroll = () => {
      if (!offer || busy || skipPath) return
      if (visible && !scrollAwaySent.current) {
        scrollAwaySent.current = true
        trackCurtain(
          CURTAIN_EVENT_TYPES.response,
          curtainEventPayload(offer, { response: 'scroll_away' satisfies CurtainResponseType }),
        )
      }
      setVisible(false)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        const prefs = readCurtainPrefsClient()
        if (!canShowOffer(prefs.offers[offer.offerId], Date.now(), policy.maxImpressionsPerDay)) return
        setVisible(true)
        shownAt.current = Date.now()
        scrollAwaySent.current = false
        trackCurtain(CURTAIN_EVENT_TYPES.shown, curtainEventPayload(offer, { resurface: true }))
      }, CURTAIN_SCROLL_STOP_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [busy, offer, policy.maxImpressionsPerDay, skipPath, visible])

  const bannerVisible = Boolean(offer) && visible && !busy && !skipPath
  const displayOffer = offer
    ? {
        ...offer,
        line2:
          offer.kind === 'a2hs' && isIosSafari()
            ? { text: t('a2hsLine2Ios') }
            : offer.kind === 'a2hs' && isIosBrowserTab()
              ? { text: textOrFallback(t, 'a2hsLine2ChromeIos') }
              : offer.line2,
        ctaText:
          offer.kind === 'a2hs' && isIosSafari() && !deferredPrompt.current
            ? t('a2hsCtaIos')
            : offer.kind === 'a2hs' && isIosBrowserTab() && !deferredPrompt.current
              ? textOrFallback(t, 'a2hsCtaChromeIos')
              : offer.ctaText,
      }
    : null

  return (
    <>
      {displayOffer ? (
        <CurtainBanner
          offer={displayOffer}
          nextOffer={nextOffer}
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
        open={installHelp === 'safari'}
        onOpenChange={(open) => setInstallHelp(open ? 'safari' : null)}
        title={t('iosInstallTitle')}
        description={t('iosInstallBody')}
        footer={<Button type="button" onClick={finishInstallHelp}>{t('iosInstallDone')}</Button>}
      >
        <p className="text-sm text-muted-foreground">{t('iosInstallBody')}</p>
      </FsModal>
      <FsModal
        open={installHelp === 'chrome'}
        onOpenChange={(open) => setInstallHelp(open ? 'chrome' : null)}
        title={textOrFallback(t, 'chromeIosTitle')}
        description={textOrFallback(t, 'chromeIosBody')}
        footer={
          <Button type="button" onClick={finishInstallHelp}>
            {textOrFallback(t, 'chromeIosDone')}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">{textOrFallback(t, 'chromeIosBody')}</p>
      </FsModal>
    </>
  )
}

export function curtainDrop(params: CurtainDropParams): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CURTAIN_DROP_EVENT, { detail: params }))
}
