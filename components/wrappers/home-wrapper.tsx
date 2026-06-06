'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Script from 'next/script'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { CONNECT_SOFTWARE_LINKS } from '@/lib/constants/connect-software-urls'
import HomeContent from '@/components/common/pages/home'
import RightSidebar from '@/features/layout/components/right-sidebar'
import MembershipUpsellCard from '@/components/common/membership-upsell-card'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'

const DesktopSidebar = dynamic(() => import('@/components/navigation/desktop-sidebar'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[240px] w-[280px] animate-pulse rounded-lg bg-muted/40" aria-hidden />
  ),
})

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

      <MembershipUpsellCard />

      <div className="space-y-3">
        <h4 className="font-medium text-sm">{tNav('explorePlatform')}</h4>
        <div className="space-y-2">
          <Link
            href={ROUTES.DOCS(locale)}
            className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-slate-50/50 to-zinc-50/50 dark:from-slate-950/30 dark:to-zinc-950/30 hover:from-slate-100 hover:to-zinc-100 dark:hover:from-slate-950/50 dark:hover:to-zinc-950/50 border border-slate-200/30 dark:border-slate-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center flex-shrink-0 text-base text-white">
              &#128218;
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{tRail('exploreClone.docsCta')}</div>
              <div className="text-xs text-muted-foreground truncate">{tRail('exploreClone.docsHint')}</div>
            </div>
          </Link>
          <Link
            href={ROUTES.ENTITIES(locale)}
            className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/30 hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-950/50 dark:hover:to-green-950/50 border border-emerald-200/30 dark:border-emerald-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 text-base">
              &#127970;
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{tNav('exploreEntities')}</div>
              <div className="text-xs text-muted-foreground truncate">{tNav('browseDirectory')}</div>
            </div>
          </Link>
          <Link
            href={ROUTES.OPPORTUNITIES(locale)}
            className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-950/50 dark:hover:to-indigo-950/50 border border-blue-200/30 dark:border-blue-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 text-base">
              &#128188;
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{tNav('findOpportunities')}</div>
              <div className="text-xs text-muted-foreground truncate">{tNav('jobsAndProjects')}</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-br from-amber-50/60 to-yellow-50/60 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/40 dark:border-amber-800/40 rounded-xl">
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

      <div className="p-4 bg-gradient-to-br from-violet-50/60 to-purple-50/60 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/40 dark:border-violet-800/40 rounded-xl space-y-3">
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
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>

      <div className="hidden lg:grid lg:grid-cols-[280px_1fr_320px] gap-6 min-h-screen" key={`desktop-${currentLocale}`}>
        <div>
          <DesktopSidebar key={`sidebar-${currentLocale}`} />
        </div>
        <div>
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-${currentLocale}`} session={session} />
          </Suspense>
        </div>
        <div>
          <RightSidebar key={`right-sidebar-${currentLocale}`}>
            <HomeRightRail locale={locale} />
          </RightSidebar>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-[280px_1fr] lg:hidden gap-6 min-h-screen" key={`ipad-${currentLocale}`}>
        <div>
          <DesktopSidebar key={`sidebar-ipad-${currentLocale}`} />
        </div>
        <div className="relative">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-ipad-${currentLocale}`} session={session} />
          </Suspense>
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <HomeRightRail locale={locale} />
          </FloatingSidebarToggle>
        </div>
      </div>

      <div className="md:hidden px-4" key={`mobile-${currentLocale}`}>
        <Suspense fallback={<LoadingFallback />}>
          <HomeContent key={`home-content-mobile-${currentLocale}`} session={session} />
        </Suspense>
      </div>

      <Script src="/scripts/hero-animations.js" strategy="afterInteractive" />
      <Script src="/scripts/home-interactions.js" strategy="afterInteractive" />
    </div>
  )
}
