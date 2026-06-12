'use client'

import React, { Suspense } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { CONNECT_SOFTWARE_LINKS } from '@/lib/constants/connect-software-urls'
import { BookOpen, Briefcase, Building2 } from 'lucide-react'
import HomeContent from '@/components/common/pages/home'
import RightSidebar from '@/features/layout/components/right-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { DavinciRailLink } from '@/lib/ui/davinci'
import { davinciPanelSurface } from '@/lib/ui/davinci/glass-surface'
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
function HomeRightRail({ locale }: { locale: Locale }) {
  const tRail = useTranslations('pages.home.rightRail')
  const tNav = useTranslations('navigation.sidebar')

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">{tRail('ecosystemTitle')}</h3>
        <div className="grid grid-cols-1 gap-4">
          {STAT_KEYS.map((key) => (
            <div key={key} className="bg-muted/30 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-primary">{tRail(`stats.${key}.value`)}</div>
              <div className="text-sm text-muted-foreground">{tRail(`stats.${key}.label`)}</div>
              <div className="text-xs text-muted-foreground mt-1">{tRail(`stats.${key}.hint`)}</div>
            </div>
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

      <div className={cn(davinciPanelSurface, 'space-y-3 p-4')}>
        <h4 className="font-semibold text-sm mb-1">{tRail('ringdomSettler.title')}</h4>
        <p className="text-xs text-muted-foreground mb-3">{tRail('ringdomSettler.body')}</p>
        <a
          href="https://ringdom.org/en/settler"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
        >
          {tRail('ringdomSettler.cta')} <span className="text-[10px]">&#8599;</span>
        </a>
      </div>

      <div className={cn(davinciPanelSurface, 'space-y-3 p-4')}>
        <h4 className="font-semibold text-sm">{tRail('legiox.title')}</h4>
        <p className="text-xs text-muted-foreground">{tRail('legiox.body')}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={CONNECT_SOFTWARE_LINKS.marketplace}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline"
          >
            {tRail('legiox.connectMarketplace')} &#8599;
          </a>
          <a
            href={CONNECT_SOFTWARE_LINKS.skillsets}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-violet-600/90 dark:text-violet-400/90 hover:underline"
          >
            {tRail('legiox.connectSkillsets')}
          </a>
          <a
            href={CONNECT_SOFTWARE_LINKS.mcpServers}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-violet-600/90 dark:text-violet-400/90 hover:underline"
          >
            {tRail('legiox.connectMcp')}
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{tRail('legiox.nftNote')}</p>
        <Link
          href={`${ROUTES.DOCS(locale)}/legiox-nft-access`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline"
        >
          {tRail('legiox.cta')}
        </Link>
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

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>

      <div className="hidden min-h-full gap-0 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]" key={`desktop-${currentLocale}`}>
        <div className="ring-content-panel ring-content-panel-flush min-w-0">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-${currentLocale}`} session={session} />
          </Suspense>
        </div>
        <div className="ring-right-rail self-stretch min-h-0 pt-4 pr-3">
          <RightSidebar key={`right-sidebar-${currentLocale}`} sticky={false} className="h-full max-h-none">
            <HomeRightRail locale={locale} />
          </RightSidebar>
        </div>
      </div>

      <div className="hidden min-h-full md:block lg:hidden" key={`ipad-${currentLocale}`}>
        <div className="ring-content-panel ring-content-panel-flush relative min-h-full">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-ipad-${currentLocale}`} session={session} />
          </Suspense>
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <HomeRightRail locale={locale} />
          </FloatingSidebarToggle>
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
