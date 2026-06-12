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
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '0.75rem',
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <Link
            href={ROUTES.ADD_OPPORTUNITY(currentLocale)}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.12) 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(234, 88, 12, 0.16) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(245, 158, 11, 0.35)'
                : 'rgba(245, 158, 11, 0.45)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(245, 158, 11) 0%, rgb(234, 88, 12) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
              color: 'white',
            }}>&#9998;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{tPages('hero.ctaCards.postOpportunity.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.postOpportunity.description')}</div>
            </div>
          </Link>
          <Link
            href={ROUTES.OPPORTUNITIES(currentLocale)}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.14) 0%, rgba(99, 102, 241, 0.14) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.3)'
                : 'rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(99, 102, 241) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
              color: 'white',
            }}>&#128188;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{tPages('hero.ctaCards.browseContractor.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.browseContractor.description')}</div>
            </div>
          </Link>
          <Link
            href={`${ROUTES.DOCS(currentLocale)}/getting-started`}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.25)'
                : 'rgba(59, 130, 246, 0.35)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(59, 130, 246, 0.2)'
                : '0 8px 24px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(99, 102, 241) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>{'>'}_</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>{tPages('hero.ctaCards.clone.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.clone.description')}</div>
            </div>
          </Link>
          <Link
            href={ROUTES.ENTITIES(currentLocale)}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(16, 185, 129, 0.25)'
                : 'rgba(16, 185, 129, 0.35)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(16, 185, 129, 0.2)'
                : '0 8px 24px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(16, 185, 129) 0%, rgb(5, 150, 105) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>&#127970;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>{tPages('hero.ctaCards.entities.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.entities.description')}</div>
            </div>
          </Link>
          <a
            href={CONNECT_SOFTWARE_LINKS.marketplace}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(124, 58, 237, 0.14) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(139, 92, 246, 0.35)'
                : 'rgba(139, 92, 246, 0.45)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(124, 58, 237) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
              color: 'white',
            }}>&#129302;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                {tPages('hero.ctaCards.connectSoftware.title')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>&#8599;</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>
                {tPages('hero.ctaCards.connectSoftware.description')}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'hsl(var(--primary))' }}>{tPages('hero.ctaCards.connectSoftware.skillsetsLink')}</span>
                <span>·</span>
                <span style={{ color: 'hsl(var(--primary))' }}>{tPages('hero.ctaCards.connectSoftware.mcpLink')}</span>
              </div>
            </div>
          </a>
          <Link
            href={ROUTES.WALLET(currentLocale) + '/topup'}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(236, 72, 153, 0.12) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(168, 85, 247, 0.25)'
                : 'rgba(168, 85, 247, 0.35)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(168, 85, 247, 0.2)'
                : '0 8px 24px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>&#129689;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>{tPages('hero.ctaCards.wallet.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.wallet.description')}</div>
            </div>
          </Link>
          <Link
            href={ROUTES.DOCS(currentLocale)}
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(59, 130, 246, 0.15)'
                : '0 8px 24px rgba(0,0,0,0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(147, 51, 234) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>&#128214;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>{tPages('hero.ctaCards.docs.title')}</div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.docs.description')}</div>
            </div>
          </Link>
          <a
            href="https://ringdom.org/en/settler"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkStyle,
              background: currentTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(217, 119, 6, 0.12) 100%)',
              border: '1px solid',
              borderColor: currentTheme === 'dark'
                ? 'rgba(234, 179, 8, 0.3)'
                : 'rgba(234, 179, 8, 0.4)',
              borderRadius: '12px',
              padding: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              color: 'hsl(var(--foreground))',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' 
                ? '0 8px 24px rgba(234, 179, 8, 0.25)'
                : '0 8px 24px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = currentTheme === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgb(234, 179, 8) 0%, rgb(217, 119, 6) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0
            }}>&#128081;</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--foreground))' }}>{tPages('hero.ctaCards.settler.title')} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>&#8599;</span></div>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', lineHeight: '1.4' }}>{tPages('hero.ctaCards.settler.description')}</div>
            </div>
          </a>
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



