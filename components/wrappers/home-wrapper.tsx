'use client'

import React, { Suspense } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import HomeContent from '@/components/common/pages/home'
import { User } from 'next-auth'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import RightSidebar from '@/features/layout/components/right-sidebar'
import MembershipUpsellCard from '@/components/common/membership-upsell-card'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { useLocale } from 'next-intl'

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

/**
 * HomeWrapperProps interface
 * @interface HomeWrapperProps
 * @property {string | null} userAgent - The user agent string from the request headers
 * @property {string | undefined} token - The authentication token from cookies
 * @property {{ slug?: string }} params - The route parameters
 * @property {{ [key: string]: string | string[] | undefined }} searchParams - The search parameters from the URL
 * @property {User | undefined} user - The authenticated user object
 */
interface HomeWrapperProps {
  userAgent: string | null;
  token: string | undefined;
  params: { slug?: string };
  searchParams: { [key: string]: string | string[] | undefined };
  user: User | undefined;
}

/**
 * HomeWrapper component
 * This component wraps the main content of the home page and handles session management.
 * 
 * User steps:
 * 1. The component is rendered with props from the server
 * 2. It checks for an active session using useSession hook
 * 3. The main content is rendered within a Suspense boundary for smooth loading
 * 4. Additional data (userAgent, token, params, searchParams) is available for potential use
 * 
 * @param {HomeWrapperProps} props - The component props
 * @returns {JSX.Element} The rendered HomeWrapper component
 */
export default function HomeWrapper({ userAgent, token, params, searchParams, user }: HomeWrapperProps) {
  const { data: session } = useSession()
  const currentLocale = useLocale()
  const t = useTranslations('navigation.sidebar')

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {/* Static links for Google bot */}
      <div style={{position: 'absolute', top: '-9999px', left: '-9999px'}}>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>

      {/* Desktop Layout - Three-column grid (desktop only, hidden on mobile and iPad) */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr_320px] gap-6 min-h-screen" key={`desktop-${currentLocale}`}>
        {/* Left Sidebar - Navigation */}
        <div>
          <DesktopSidebar key={`sidebar-${currentLocale}`} />
        </div>

        {/* Main Content - Home Page */}
        <div>
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-${currentLocale}`} session={session} />
          </Suspense>
        </div>

        {/* Right Sidebar - Membership and Quick Actions (desktop only) */}
        <div>
          <RightSidebar key={`right-sidebar-${currentLocale}`}>
            <div className="space-y-6">
              {/* Ecosystem Power Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ring Ecosystem Power</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">20+</div>
                    <div className="text-sm text-muted-foreground">Integrated Modules</div>
                    <div className="text-xs text-muted-foreground mt-1">Complete business platform</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">3</div>
                    <div className="text-sm text-muted-foreground">Database Options</div>
                    <div className="text-xs text-muted-foreground mt-1">Your choice, your control</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">RING</div>
                    <div className="text-sm text-muted-foreground">Token Economy</div>
                    <div className="text-xs text-muted-foreground mt-1">Powers all operations</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">AI</div>
                    <div className="text-sm text-muted-foreground">Powered Matching</div>
                    <div className="text-xs text-muted-foreground mt-1">8-factor scoring system</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">⚡</div>
                    <div className="text-sm text-muted-foreground">White-label Ready</div>
                    <div className="text-xs text-muted-foreground mt-1">Deploy in hours</div>
                  </div>
                </div>
              </div>

              {/* Membership Upsell */}
              <MembershipUpsellCard />

              {/* Explore Platform */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm mb-2">{t('explorePlatform')}</h4>
                <div className="space-y-2">
                  <Link
                    href={`/${currentLocale}/entities`}
                    className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/30 hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-950/50 dark:hover:to-green-950/50 border border-emerald-200/30 dark:border-emerald-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 text-base">
                      &#127970;
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t('exploreEntities')}</div>
                      <div className="text-xs text-muted-foreground truncate">{t('browseDirectory')}</div>
                    </div>
                  </Link>
                  <Link
                    href={`/${currentLocale}/opportunities`}
                    className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-950/50 dark:hover:to-indigo-950/50 border border-blue-200/30 dark:border-blue-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 text-base">
                      &#128188;
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t('findOpportunities')}</div>
                      <div className="text-xs text-muted-foreground truncate">{t('jobsAndProjects')}</div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Ringdom Turn-Key Service */}
              <div className="p-4 bg-gradient-to-br from-amber-50/60 to-yellow-50/60 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/40 dark:border-amber-800/40 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Ringdom Turn-Key Service</h4>
                <p className="text-xs text-muted-foreground mb-3">Let Ringdom handle everything: AI customization, enterprise hosting, and ongoing support.</p>
                <a
                  href="https://ringdom.org/en/settler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Become a Settler <span className="text-[10px]">&#8599;</span>
                </a>
              </div>

              {/* Legion AI Skillsets */}
              <div className="p-4 bg-gradient-to-br from-violet-50/60 to-purple-50/60 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/40 dark:border-violet-800/40 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Legion AI Skillsets</h4>
                <p className="text-xs text-muted-foreground mb-1">147+ specialized Ring AI agents. Install as Cursor Plugin.</p>
                <p className="text-[10px] text-muted-foreground/70 mb-3">Requires Legion-Access NFT</p>
                <Link
                  href={`/${currentLocale}/docs/legion-nft-access`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </RightSidebar>
        </div>
      </div>

      {/* iPad Layout - Two-column grid (sidebar + feed), hidden on mobile and desktop */}
      <div className="hidden md:grid md:grid-cols-[280px_1fr] lg:hidden gap-6 min-h-screen" key={`ipad-${currentLocale}`}>
        {/* Left Sidebar - Navigation */}
        <div>
          <DesktopSidebar key={`sidebar-ipad-${currentLocale}`} />
        </div>

        {/* Main Content - Home Page */}
        <div className="relative">
          <Suspense fallback={<LoadingFallback />}>
            <HomeContent key={`home-content-ipad-${currentLocale}`} session={session} />
          </Suspense>

          {/* Floating Sidebar Toggle for Right Sidebar */}
          <FloatingSidebarToggle key={`toggle-ipad-${currentLocale}`}>
            <div className="space-y-6">
              {/* Ecosystem Power Stats */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ring Ecosystem Power</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">20+</div>
                    <div className="text-sm text-muted-foreground">Integrated Modules</div>
                    <div className="text-xs text-muted-foreground mt-1">Complete business platform</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">3</div>
                    <div className="text-sm text-muted-foreground">Database Options</div>
                    <div className="text-xs text-muted-foreground mt-1">Your choice, your control</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">RING</div>
                    <div className="text-sm text-muted-foreground">Token Economy</div>
                    <div className="text-xs text-muted-foreground mt-1">Powers all operations</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">AI</div>
                    <div className="text-sm text-muted-foreground">Powered Matching</div>
                    <div className="text-xs text-muted-foreground mt-1">8-factor scoring system</div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">⚡</div>
                    <div className="text-sm text-muted-foreground">White-label Ready</div>
                    <div className="text-xs text-muted-foreground mt-1">Deploy in hours</div>
                  </div>
                </div>
              </div>

              {/* Membership Upsell */}
              <MembershipUpsellCard />

              {/* Explore Platform */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm mb-2">{t('explorePlatform')}</h4>
                <div className="space-y-2">
                  <Link
                    href={`/${currentLocale}/entities`}
                    className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/30 hover:from-emerald-100 hover:to-green-100 dark:hover:from-emerald-950/50 dark:hover:to-green-950/50 border border-emerald-200/30 dark:border-emerald-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 text-base">
                      &#127970;
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t('exploreEntities')}</div>
                      <div className="text-xs text-muted-foreground truncate">{t('browseDirectory')}</div>
                    </div>
                  </Link>
                  <Link
                    href={`/${currentLocale}/opportunities`}
                    className="flex items-center gap-3 w-full p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-950/50 dark:hover:to-indigo-950/50 border border-blue-200/30 dark:border-blue-800/50 rounded-xl transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 text-base">
                      &#128188;
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t('findOpportunities')}</div>
                      <div className="text-xs text-muted-foreground truncate">{t('jobsAndProjects')}</div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Ringdom Turn-Key Service */}
              <div className="p-4 bg-gradient-to-br from-amber-50/60 to-yellow-50/60 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200/40 dark:border-amber-800/40 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Ringdom Turn-Key Service</h4>
                <p className="text-xs text-muted-foreground mb-3">AI customization, enterprise hosting, and ongoing support.</p>
                <a
                  href="https://ringdom.org/en/settler"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Become a Settler <span className="text-[10px]">&#8599;</span>
                </a>
              </div>

              {/* Legion AI Skillsets */}
              <div className="p-4 bg-gradient-to-br from-violet-50/60 to-purple-50/60 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/40 dark:border-violet-800/40 rounded-xl">
                <h4 className="font-semibold text-sm mb-1">Legion AI Skillsets</h4>
                <p className="text-xs text-muted-foreground mb-1">147+ specialized Ring AI agents.</p>
                <p className="text-[10px] text-muted-foreground/70 mb-3">Requires Legion-Access NFT</p>
                <Link
                  href={`/${currentLocale}/docs/legion-nft-access`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </FloatingSidebarToggle>
        </div>
      </div>

      {/* Mobile Layout - Stack vertically, hidden on iPad and desktop */}
      <div className="md:hidden px-4" key={`mobile-${currentLocale}`}>
        <Suspense fallback={<LoadingFallback />}>
          <HomeContent key={`home-content-mobile-${currentLocale}`} session={session} />
        </Suspense>
      </div>

      {/* Example usage of new async data */}
      <div className="hidden">
        <p>User Agent: {userAgent}</p>
        <p>Token: {token}</p>
        <p>Params: {JSON.stringify(params)}</p>
        <p>Search Params: {JSON.stringify(searchParams)}</p>
        <p>User: {JSON.stringify(user)}</p>
      </div>
      {/* Load hero animations and interactions */}
      <Script src="/scripts/hero-animations.js" strategy="afterInteractive" />
      <Script src="/scripts/home-interactions.js" strategy="afterInteractive" />
    </div>
  )
}




