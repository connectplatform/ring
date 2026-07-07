'use client'

import React, { useState, useEffect } from 'react'
import { motion, Variants } from 'framer-motion'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Session } from 'next-auth'
import type { Locale } from '@/i18n/shared'
import {
  HeroAmbient,
  HeroMobileLogo,
  TerminalCommandBlock,
} from '@/lib/ui/davinci'
import { RingDeploymentPaths } from '@/components/docs/ring-deployment-paths'
import { FeatureShowcaseGallery } from '@/components/ring-widgets/feature-showcase-gallery'
import { cn } from '@/lib/utils'

interface HomeContentProps {
  session: Session | null
}

const HomeContent: React.FC<HomeContentProps> = ({ session }) => {
  const tCommon = useTranslations('common')
  const tPages = useTranslations('pages.home')
  const currentLocale = useLocale() as Locale
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
    color: 'hsl(var(--foreground))',
    transformOrigin: '50% 50%'
  }

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    marginBottom: '2rem',
    maxWidth: '90vw',
    margin: '0 auto 2rem',
    color: 'var(--muted-foreground)'
  }

  return (
    <>
      {/* ───────── HERO ───────── */}
      <section className="relative flex min-h-[100dvh] w-full flex-col justify-center overflow-hidden bg-gradient-to-br from-primary/[0.045] via-[hsl(var(--app-panel))] to-[hsl(var(--app-panel))] px-4 py-8 text-center md:min-h-[520px] md:px-8 md:py-12 lg:px-11 lg:py-[26px]">
        <HeroAmbient />
        <div className="relative z-10 mx-auto w-full max-w-[1200px]">
          {mounted && <HeroMobileLogo />}

          <motion.h1
            style={titleStyle}
            variants={mounted ? titleVariants : undefined}
            initial={mounted ? 'hidden' : false}
            animate={mounted ? 'visible' : false}
            className="motion-safe motion-element"
          >
            {tPages('hero.title')}
          </motion.h1>

          {/* Subtitle with GitHub link */}
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
            {tPages('hero.subtitlePrefix')}
            <Link
              href="https://github.com/connectplatform/ring"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {tPages('hero.subtitleLink')}
            </Link>
            {tPages('hero.subtitleSuffix')}
          </motion.p>

          {/* Pitch */}
          <motion.p
            className="motion-safe motion-element mx-auto mb-8 max-w-2xl text-pretty text-base sm:text-lg leading-relaxed text-muted-foreground"
            variants={mounted ? textVariants : undefined}
            initial={mounted ? 'hidden' : false}
            animate={mounted ? 'visible' : false}
          >
            {tPages('hero.pitch')}
          </motion.p>
        </div>
      </section>

      <div style={containerStyle}>
        {/* ───────── FEATURE SHOWCASE GALLERY ───────── */}
        <motion.section
          className="motion-safe motion-element mb-16"
          variants={mounted ? linksVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
        >
          <FeatureShowcaseGallery />
        </motion.section>

        {/* ───────── GIT CLONE ───────── */}
        <motion.div
          style={{
            ...descriptionStyle,
            textAlign: 'center',
          }}
          variants={mounted ? textVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
          className="motion-safe motion-element mb-16"
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

        {/* ───────── RING DEPLOYMENT PATHS ───────── */}
        <motion.section
          className="motion-safe motion-element"
          variants={mounted ? linksVariants : undefined}
          initial={mounted ? 'hidden' : false}
          animate={mounted ? 'visible' : false}
        >
          <RingDeploymentPaths locale={currentLocale as 'en' | 'uk' | 'ru'} />
        </motion.section>
      </div>
    </>
  )
}

export default HomeContent
