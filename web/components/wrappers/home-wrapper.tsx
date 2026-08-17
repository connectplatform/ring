'use client'

import React, { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { BookOpen, Briefcase, Building2 } from 'lucide-react'
import HomeContent from '@/components/pages/home-content-resolver'
import RightSidebar from '@/features/layout/components/right-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { DavinciRailLink, DavinciGlassStatBlock } from '@/lib/ui/davinci'
import { getHomePreset } from '@/lib/ring-config-core'
import { resolveOverlayHomeRail } from '@/lib/overlay/runtime'
import { cn } from '@/lib/utils'

function LoadingFallback() {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative transition-colors duration-300">
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">{t('loading')}</div>
      </div>
    </div>
  )
}

type StatKey = 'oss' | 'modules' | 'matcher' | 'ringdom' | 'audience'

const STAT_KEYS: StatKey[] = ['oss', 'modules', 'matcher', 'ringdom', 'audience']

/**
 * Right rail: Ring OSS marketplace + Ringdom ringization narrative (i18n: pages.home.rightRail).
 */

/**
 * Vertical home rail: Tier-3 overlay only (clone registers in lib/overlay/registry.ts).
 * Platform never inlines Cosmic Mirror / n9life product UI.
 */
function OverlayHomeRightRailHost({ locale }: { locale: Locale }) {
  const [Rail, setRail] = useState<ComponentType<{ locale: Locale }> | null>(null)

  useEffect(() => {
    let cancelled = false
    void resolveOverlayHomeRail().then((Comp) => {
      if (!cancelled) setRail(() => Comp)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!Rail) return null
  return <Rail locale={locale} />
}

function HomeRightRail({ locale }: { locale: Locale }) {
  if (getHomePreset() !== 'platform') {
    return <OverlayHomeRightRailHost locale={locale} />
  }
  return <PlatformHomeRightRail locale={locale} />
}

function PlatformHomeRightRail({ locale }: { locale: Locale }) {
  const tRail = useTranslations('pages.home.rightRail')
  const tNav = useTranslations('navigation.sidebar')

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">{tRail('ecosystemTitle')}</h3>
        <div className="grid grid-cols-1 gap-3">
          {STAT_KEYS.map((key) => (
            <DavinciGlassStatBlock
              key={key}
              value={tRail(`stats.${key}.value`)}
              label={tRail(`stats.${key}.label`)}
              hint={tRail(`stats.${key}.hint`)}
            />
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <h4 className="font-semibold text-sm">{tRail('twoPaths.title')}</h4>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground text-sm mb-1">{tRail('twoPaths.platformTitle')}</p>
            <p>{tRail('twoPaths.platformBody')}</p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm mb-1">{tRail('twoPaths.ringdomTitle')}</p>
            <p>{tRail('twoPaths.ringdomBody')}</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
        <h4 className="font-semibold text-sm">{tRail('freelanceMarket.title')}</h4>
        <p className="text-xs text-muted-foreground">{tRail('freelanceMarket.body')}</p>
        <div className="flex flex-col gap-2">
          <Link
            href={ROUTES.ADD_OPPORTUNITY(locale)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {tRail('freelanceMarket.postCta')}
          </Link>
          <Link
            href={ROUTES.OPPORTUNITIES(locale)}
            className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/50 transition-colors"
          >
            {tRail('freelanceMarket.browseCta')}
          </Link>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
        <h4 className="font-semibold text-sm">{tRail('audiences.title')}</h4>
        <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
          <li>{tRail('audiences.ceos')}</li>
          <li>{tRail('audiences.developers')}</li>
          <li>{tRail('audiences.contractors')}</li>
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">{tNav('explorePlatform')}</h4>
        <div className="space-y-2">
          <DavinciRailLink
            href={ROUTES.DOCS(locale)}
            title={tRail('exploreClone.docsCta')}
            hint={tRail('exploreClone.docsHint')}
            icon={<BookOpen className="size-4" strokeWidth={1.5} />}
          />
          <DavinciRailLink
            href={ROUTES.ENTITIES(locale)}
            title={tNav('exploreEntities')}
            hint={tNav('browseDirectory')}
            icon={<Building2 className="size-4" strokeWidth={1.5} />}
          />
          <DavinciRailLink
            href={ROUTES.OPPORTUNITIES(locale)}
            title={tNav('findOpportunities')}
            hint={tNav('jobsAndProjects')}
            icon={<Briefcase className="size-4" strokeWidth={1.5} />}
          />
        </div>
      </div>

    </div>
  )
}

/**
 * Home chrome — session via `useSession`; desktop sidebar loaded on demand (wagmi/nav chunk).
 */
export default function HomeWrapper() {
  const { data: session } = useSession()
  const currentLocale = useLocale()
  const locale = currentLocale as Locale
  /** MVM storefront landing is product-first — no empire/OSS right rail column. */
  const fullBleedCenter = getHomePreset() !== 'platform'

  /* ── Dynamic right-rail collapse ── */
  const desktopRef = useRef<HTMLDivElement>(null)
  const [hideRail, setHideRail] = useState(false)
  const maxWidthRef = useRef(0)
  const isCollapsedRef = useRef(false)

  /**
   * Stable resize handler — refs replace state deps so useCallback has zero deps.
   * Hysteresis: hide at 50%, show at 65% of max center-pane width.
   */
  const handleRailResize = useCallback((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const w = entry.contentRect.width
      if (w <= 0) continue

      /* Track the maximum container width ever observed */
      if (w > maxWidthRef.current) {
        maxWidthRef.current = w
      }

      const maxW = maxWidthRef.current
      if (maxW <= 320) continue

      /*
       * Center-pane width = container width − 320px right-rail.
       * Hide rail when center < 50% of max center:
       *   w − 320 < 0.50 × (maxW − 320)  →  w < 0.50 × maxW + 160
       * Show rail when center > 65% of max center (hysteresis):
       *   w − 320 > 0.65 × (maxW − 320)  →  w > 0.65 × maxW + 112
       */
      if (isCollapsedRef.current) {
        if (w > 0.65 * maxW + 112) {
          isCollapsedRef.current = false
          setHideRail(false)
        }
      } else {
        if (w < 0.50 * maxW + 160) {
          isCollapsedRef.current = true
          setHideRail(true)
        }
      }
    }
    // setHideRail is stable (React guarantees useState setter identity)
    // Refs (maxWidthRef, isCollapsedRef) bypass closure staleness
    // → zero deps, created once
  }, [])

  useEffect(() => {
    const el = desktopRef.current
    if (!el) return

    const observer = new ResizeObserver(handleRailResize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleRailResize])

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>

      {/* ── DESKTOP (right rail collapses dynamically) ── */}
      <div
        ref={desktopRef}
        key={`desktop-${currentLocale}`}
        className={cn(
          'hidden min-h-full gap-0 lg:grid',
          hideRail || fullBleedCenter
            ? 'lg:grid-cols-1'
            : 'lg:grid-cols-[minmax(0,1fr)_320px]',
        )}
      >
        <div className="ring-content-panel ring-content-panel-flush min-w-0">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-${currentLocale}`} session={session} />
          </Suspense>
        </div>
        {!hideRail && !fullBleedCenter && (
          <div className="ring-right-rail self-stretch min-h-0 pt-4 pr-3">
            <RightSidebar key={`right-sidebar-${currentLocale}`} sticky={false} className="h-full max-h-none">
              <HomeRightRail locale={locale} />
            </RightSidebar>
          </div>
        )}
      </div>

      <div className="hidden min-h-full md:block lg:hidden" key={`ipad-${currentLocale}`}>
        <div className="ring-content-panel ring-content-panel-flush relative min-h-full">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-ipad-${currentLocale}`} session={session} />
          </Suspense>
          {!fullBleedCenter && (
            <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
              <HomeRightRail locale={locale} />
            </FloatingSidebarToggle>
          )}
        </div>
      </div>

      <div className="px-1 pb-4 md:hidden" key={`mobile-${currentLocale}`}>
        <div className="ring-content-panel ring-content-panel-flush min-h-full">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-mobile-${currentLocale}`} session={session} />
          </Suspense>
        </div>
      </div>

      <Script src="/scripts/hero-animations.js" strategy="afterInteractive" />
      <Script src="/scripts/home-interactions.js" strategy="afterInteractive" />
    </div>
  )
}
