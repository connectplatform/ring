'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, Variants } from 'framer-motion'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Session } from 'next-auth'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { CONNECT_SOFTWARE_LINKS } from '@/lib/constants/connect-software-urls'
import {
  BorderBeam,
  DavinciCtaLink,
  HeroAmbient,
  HeroFeatureRotator,
  HeroMobileLogo,
  TerminalCommandBlock,
  davinciBeamInnerSurface,
  davinciPanelSurface,
} from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

/**
 * @interface HomeContentProps
 * @property {Session | null} session - The user's session information
 */
interface HomeContentProps {
  session: Session | null
}

const pathCardBase =
  'flex items-center gap-4 rounded-xl border p-5 text-left no-underline text-foreground transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5'

const pathCardSurface = {
  amber: cn(
    pathCardBase,
    'border-amber-500/40 bg-gradient-to-br from-amber-500/16 to-orange-600/16',
    'dark:border-amber-500/35 dark:from-amber-500/12 dark:to-orange-600/12',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-amber-500/20',
  ),
  blue: cn(
    pathCardBase,
    'border-blue-500/40 bg-gradient-to-br from-blue-500/14 to-indigo-500/14',
    'dark:border-blue-500/30 dark:from-blue-500/10 dark:to-indigo-500/10',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-blue-500/20',
  ),
  blueSoft: cn(
    pathCardBase,
    'border-blue-500/35 bg-gradient-to-br from-blue-500/12 to-indigo-500/12',
    'dark:border-blue-500/25 dark:from-blue-500/8 dark:to-indigo-500/8',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-blue-500/15',
  ),
  emerald: cn(
    pathCardBase,
    'border-emerald-500/35 bg-gradient-to-br from-emerald-500/12 to-emerald-600/12',
    'dark:border-emerald-500/25 dark:from-emerald-500/8 dark:to-emerald-600/8',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-emerald-500/20',
  ),
  violet: cn(
    pathCardBase,
    'border-violet-500/40 bg-gradient-to-br from-violet-500/14 to-violet-600/14',
    'dark:border-violet-500/35 dark:from-violet-500/10 dark:to-violet-600/10',
  ),
  fuchsia: cn(
    pathCardBase,
    'border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-500/12 to-pink-500/12',
    'dark:border-fuchsia-500/25 dark:from-fuchsia-500/8 dark:to-pink-500/8',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-fuchsia-500/20',
  ),
  blueMuted: cn(
    pathCardBase,
    'border-blue-500/30 bg-gradient-to-br from-blue-500/8 to-violet-500/8',
    'dark:border-blue-500/20 dark:from-blue-500/5 dark:to-violet-500/5',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-blue-500/15',
  ),
  amberSoft: cn(
    pathCardBase,
    'border-amber-500/40 bg-gradient-to-br from-amber-400/12 to-orange-500/12',
    'dark:border-amber-500/30 dark:from-amber-400/8 dark:to-orange-500/8',
    'shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-amber-500/25',
  ),
} as const

const pathCardIconBg = {
  amber: 'linear-gradient(135deg, rgb(245, 158, 11) 0%, rgb(234, 88, 12) 100%)',
  blue: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(99, 102, 241) 100%)',
  emerald: 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)',
  violet: 'linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(124, 58, 237) 100%)',
  fuchsia: 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)',
  amberSoft: 'linear-gradient(135deg, rgb(234, 179, 8) 0%, rgb(217, 119, 6) 100%)',
} as const

type PathCardSurface = keyof typeof pathCardSurface

function HomePathCard({
  href,
  external,
  surface,
  iconBg,
  icon,
  title,
  description,
  extra,
}: {
  href: string
  external?: boolean
  surface: PathCardSurface
  iconBg: keyof typeof pathCardIconBg
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  extra?: React.ReactNode
}) {
  const content = (
    <>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-xl text-white"
        style={{ background: pathCardIconBg[iconBg] }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="mb-1 text-base font-semibold text-foreground">{title}</div>
        <div className="text-sm leading-snug text-muted-foreground">{description}</div>
        {extra}
      </div>
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={pathCardSurface[surface]}
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className={pathCardSurface[surface]}>
      {content}
    </Link>
  )
}

/**
 * HomeContent Component
 * 
 * This component renders the main content of the home page, including welcome messages,
 * descriptions, and links to other parts of the application.
 * 
 * User steps:
 * 1. User arrives at the home page
 * 2. The component animates in the welcome message and description
 * 3. Two main navigation links (entities and opportunities) are displayed
 * 4. If the user is logged in, a personalized welcome message is shown
 * 
 * @param {HomeContentProps} props - The component props
 * @returns {JSX.Element} The rendered HomeContent component
 */
const HomeContent: React.FC<HomeContentProps> = ({ session }) => {
  const tCommon = useTranslations('common')
  const tPages = useTranslations('pages.home')
  const currentLocale = useLocale() as Locale
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const heroFeatures = useMemo(
    () => (tPages.raw('hero.features') as string[]) ?? [],
    [tPages]
  )

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine the current theme (dark or light)
  const currentTheme = theme === 'system' ? resolvedTheme : theme

  // Define animation variants for different elements
  const titleVariants: Variants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  const subtitleVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } }
  }

  const textVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.4 } }
  }

  const linksVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.6 } }
  }

  const sessionMessageVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, delay: 0.8 } }
  }

  // Define styles for different elements
  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1rem',
    textAlign: 'center',
    position: 'relative',
    zIndex: 10
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 'clamp(1.75rem, 4vw, 3rem)',
    fontWeight: 'bold',
    marginBottom: '1rem',
    // Replace gradient text with token-based color to avoid overlay/stripe artifacts
    color: 'hsl(var(--foreground))',
    transformOrigin: '50% 50%'
  }

  const subtitleStyle: React.CSSProperties = {
    ...titleStyle,
    color: 'hsl(var(--primary))',
    transformOrigin: '50% 50%'
  }

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    marginBottom: '2rem',
    maxWidth: '90vw',
    margin: '0 auto 2rem',
    color: 'var(--muted-foreground)'
  }

  const linksContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    maxWidth: '90vw',
    margin: '0 auto',
    padding: '0 1rem'
  }

  const linkStyle: React.CSSProperties = {
    padding: '1rem 2rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--primary-foreground)',
    textDecoration: 'none',
    transition: 'background 0.3s ease'
  }

  const entitiesLinkStyle: React.CSSProperties = {
    ...linkStyle,
    background: currentTheme === 'dark'
      ? 'linear-gradient(to right, #2563EB, #16A34A)'
      : 'linear-gradient(to right, #3B82F6, #22C55E)'
  }

  const opportunitiesLinkStyle: React.CSSProperties = {
    ...linkStyle,
    background: currentTheme === 'dark'
      ? 'linear-gradient(to right, #16A34A, #CA8A04)'
      : 'linear-gradient(to right, #22C55E, #F59E0B)'
  }

  const sessionMessageStyle: React.CSSProperties = {
    marginTop: '2rem',
    fontSize: '1.125rem',
    color: 'var(--muted-foreground)'
  }

  return (
    <>
      {/* Full-viewport hero on mobile — ambient bleeds edge-to-edge */}
      <section className="relative flex min-h-[100dvh] w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-primary/[0.045] via-[hsl(var(--app-panel))] to-[hsl(var(--app-panel))] px-4 py-8 text-center md:min-h-[520px] md:px-8 md:py-12 lg:px-11 lg:py-[26px]">
        <HeroAmbient />
        <div className="relative z-10 mx-auto w-full max-w-[1200px]">
        {mounted && <HeroMobileLogo />}

        <motion.h1
          style={titleStyle}
          variants={mounted ? titleVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tPages('hero.title')}
        </motion.h1>

        {/* Hook */}
        <motion.p
          style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
            marginBottom: '1.25rem',
            fontWeight: 600,
            color: 'hsl(var(--primary))',
          }}
          variants={mounted ? subtitleVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
          className="motion-safe motion-element"
        >
          {tPages('hero.subtitle')}
        </motion.p>

        {/* Ringdom conversion pitch */}
        <motion.p
          className="motion-safe motion-element mx-auto mb-8 max-w-2xl text-pretty text-base sm:text-lg leading-relaxed text-muted-foreground"
          variants={mounted ? textVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
        >
          {tPages('hero.pitch')}
        </motion.p>

        {/* Primary funnel — Ringdom with Grok-style traveling border beam */}
        <motion.div
          variants={mounted ? linksVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
          className="motion-safe motion-element relative z-10 mb-10 mx-auto w-full max-w-md"
        >
          <BorderBeam
            className="mx-auto w-full max-w-md rounded-xl"
            innerClassName={cn(davinciBeamInnerSurface, 'border-0')}
            duration="4s"
          >
            <DavinciCtaLink href={tPages('hero.ringdomUrl')} className="w-full">
              {tPages('hero.ringdomCta')}
            </DavinciCtaLink>
          </BorderBeam>
        </motion.div>

      {/* OSS path — git clone */}
      <motion.div
        style={{
          ...descriptionStyle,
          textAlign: 'center',
          marginTop: '2rem'
        }}
        variants={mounted ? textVariants : undefined}
        initial={mounted ? "hidden" : false}
        animate={mounted ? "visible" : false}
        className="motion-safe motion-element"
      >
        <p className="mb-4 text-[1.1rem] font-medium">
          {tPages('hero.gitCloneText')}
        </p>
        <TerminalCommandBlock
          className="mx-auto max-w-[600px]"
          command={tPages('hero.gitClone')}
          copyLabel={tCommon('contact.copyToClipboard')}
        />
      </motion.div>

      {/* Feature rotator — blur crossfade + dot indicators */}
      <motion.div
        className="motion-safe motion-element mt-8"
        variants={mounted ? textVariants : undefined}
        initial={mounted ? 'hidden' : false}
        animate={mounted ? 'visible' : false}
      >
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          {tPages('hero.featuresLabel')}
        </p>
        {mounted && heroFeatures.length > 0 && (
          <HeroFeatureRotator features={heroFeatures} intervalMs={4500} />
        )}
      </motion.div>
        </div>
      </section>

      <div style={containerStyle}>
      {/* Marketplace — primary CTAs */}
      <motion.div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          maxWidth: '640px',
          marginLeft: 'auto',
          marginRight: 'auto',
          textAlign: 'center',
        }}
        className={cn(
          davinciPanelSurface,
          'motion-safe motion-element relative z-10 mx-auto mt-8 max-w-[640px] p-6 text-center'
        )}
        variants={mounted ? linksVariants : undefined}
        initial={mounted ? 'hidden' : false}
        animate={mounted ? 'visible' : false}
      >
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'hsl(var(--foreground))',
            marginBottom: '0.75rem',
          }}
        >
          {tPages('hero.marketplaceBand.title')}
        </h3>
        <p
          style={{
            fontSize: '0.9rem',
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1.5,
            marginBottom: '1.25rem',
          }}
        >
          {tPages('hero.marketplaceBand.subtitle')}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'stretch',
          }}
        >
          <Link
            href={ROUTES.ADD_OPPORTUNITY(currentLocale)}
            style={{
              ...linkStyle,
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              textAlign: 'center',
              padding: '0.875rem 1.25rem',
            }}
          >
            {tPages('hero.marketplaceBand.postCta')}
          </Link>
          <Link
            href={ROUTES.OPPORTUNITIES(currentLocale)}
            style={{
              ...linkStyle,
              background: 'transparent',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              textAlign: 'center',
              padding: '0.875rem 1.25rem',
            }}
          >
            {tPages('hero.marketplaceBand.browseCta')}
          </Link>
        </div>
      </motion.div>

      {/* Path cards */}
      <motion.div
        style={{
          ...linksContainerStyle,
          marginTop: '2rem'
        }}
        variants={mounted ? linksVariants : undefined}
        initial={mounted ? "hidden" : false}
        animate={mounted ? "visible" : false}
        className="motion-safe motion-element"
      >
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'hsl(var(--foreground))', marginBottom: '1rem' }}>
            {tPages('hero.cta')}
          </h3>
        </div>
        <div className="mx-auto grid w-full max-w-[500px] grid-cols-1 gap-3">
          <HomePathCard
            href={ROUTES.ADD_OPPORTUNITY(currentLocale)}
            surface="amber"
            iconBg="amber"
            icon={<span>&#9998;</span>}
            title={tPages('hero.ctaCards.postOpportunity.title')}
            description={tPages('hero.ctaCards.postOpportunity.description')}
          />
          <HomePathCard
            href={ROUTES.OPPORTUNITIES(currentLocale)}
            surface="blue"
            iconBg="blue"
            icon={<span>&#128188;</span>}
            title={tPages('hero.ctaCards.browseContractor.title')}
            description={tPages('hero.ctaCards.browseContractor.description')}
          />
          <HomePathCard
            href={`${ROUTES.DOCS(currentLocale)}/getting-started`}
            surface="blueSoft"
            iconBg="blue"
            icon={<span>{'>'}_</span>}
            title={tPages('hero.ctaCards.clone.title')}
            description={tPages('hero.ctaCards.clone.description')}
          />
          <HomePathCard
            href={ROUTES.ENTITIES(currentLocale)}
            surface="emerald"
            iconBg="emerald"
            icon={<span>&#127970;</span>}
            title={tPages('hero.ctaCards.entities.title')}
            description={tPages('hero.ctaCards.entities.description')}
          />
          <HomePathCard
            href={CONNECT_SOFTWARE_LINKS.marketplace}
            external
            surface="violet"
            iconBg="violet"
            icon={<span className="text-lg">&#129302;</span>}
            title={
              <>
                {tPages('hero.ctaCards.connectSoftware.title')}{' '}
                <span className="text-[0.7rem] opacity-70">&#8599;</span>
              </>
            }
            description={tPages('hero.ctaCards.connectSoftware.description')}
            extra={
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="text-primary">{tPages('hero.ctaCards.connectSoftware.skillsetsLink')}</span>
                <span>·</span>
                <span className="text-primary">{tPages('hero.ctaCards.connectSoftware.mcpLink')}</span>
              </div>
            }
          />
          <HomePathCard
            href={`${ROUTES.WALLET(currentLocale)}/topup`}
            surface="fuchsia"
            iconBg="fuchsia"
            icon={<span>&#129689;</span>}
            title={tPages('hero.ctaCards.wallet.title')}
            description={tPages('hero.ctaCards.wallet.description')}
          />
          <HomePathCard
            href={ROUTES.DOCS(currentLocale)}
            surface="blueMuted"
            iconBg="blue"
            icon={<span>&#128214;</span>}
            title={tPages('hero.ctaCards.docs.title')}
            description={tPages('hero.ctaCards.docs.description')}
          />
          <HomePathCard
            href="https://ringdom.org/en/settler"
            external
            surface="amberSoft"
            iconBg="amberSoft"
            icon={<span>&#128081;</span>}
            title={
              <>
                {tPages('hero.ctaCards.settler.title')}{' '}
                <span className="text-[0.7rem] opacity-70">&#8599;</span>
              </>
            }
            description={tPages('hero.ctaCards.settler.description')}
          />
        </div>
      </motion.div>
      {session && (
        <motion.p
          style={sessionMessageStyle}
          variants={mounted ? sessionMessageVariants : undefined}
          initial={mounted ? "hidden" : false}
          animate={mounted ? "visible" : false}
          className="motion-safe motion-element"
        >
          {tCommon('messages.welcome', { name: session.user?.name || 'User' })}
        </motion.p>
      )}
      </div>
    </>
  )
}

export default HomeContent



