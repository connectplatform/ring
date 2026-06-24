'use client'

/**
 * About Publisher layout — center content + DaVinci right guidance rail.
 */

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { PublisherGetStartedFlow } from '@/components/ring-widgets/publisher-get-started-flow'
import {
  Heart,
  Sparkles,
  Globe,
  Github,
  BookOpen,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  DavinciGlassStatBlock,
  davinciCtaPrimary,
} from '@/lib/ui/davinci'

interface AboutPublisherWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function AboutPublisherWrapper({ children, locale }: AboutPublisherWrapperProps) {
  const t = useTranslations('about-publisher')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const localeKey = locale as Locale

  useEffect(() => {
    setMounted(true)
  }, [])

  const impactStats = [
    {
      value: '50+',
      label: t('sections.impact.stats.deployments'),
      hint: t('sidebar.impact.deployments'),
    },
    {
      value: '€500M+',
      label: t('sections.impact.stats.value'),
      hint: t('sidebar.impact.value'),
    },
    {
      value: '2.5M+',
      label: t('sections.impact.stats.benefiting'),
      hint: t('sidebar.impact.benefiting'),
    },
    {
      value: '40+',
      label: t('sections.impact.stats.countries'),
      hint: t('sidebar.impact.countries'),
    },
  ] as const

  const RightSidebarContent = () => (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby="publisher-intro-heading">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
          <h2
            id="publisher-intro-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            {t('sidebar.publisher_title')}
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{t('sidebar.publisher_desc')}</p>
        <div className="flex flex-wrap gap-2">
          <DavinciGlassChip
            href="https://github.com/connectplatform/ring"
            external
            icon={<Github className="h-3 w-3" />}
          >
            {t('badges.openSource')}
          </DavinciGlassChip>
          <DavinciGlassChip
            href={ROUTES.DOCS_MCP(localeKey)}
            icon={<Sparkles className="h-3 w-3" />}
          >
            {t('badges.aiPowered')}
          </DavinciGlassChip>
          <DavinciGlassChip
            href={ROUTES.ABOUT_PUBLISHER(localeKey)}
            icon={<Globe className="h-3 w-3" />}
          >
            {t('badges.weaponOfPeace')}
          </DavinciGlassChip>
        </div>
      </section>

      <PublisherGetStartedFlow locale={localeKey} />

      <section className="space-y-2" aria-labelledby="publisher-docs-heading">
        <p className="px-0.5 text-xs leading-relaxed text-muted-foreground">{t('sidebar.help_desc')}</p>
        <a
          id="publisher-docs-heading"
          href={ROUTES.DOCS(localeKey)}
          className={cn(
            davinciCtaPrimary,
            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0',
          )}
          data-testid="publisher-docs-button"
        >
          <BookOpen className="size-4 shrink-0 text-[var(--davinci-beam)]" aria-hidden />
          {t('sidebar.help_title')}
        </a>
      </section>

      <section className="space-y-3" aria-labelledby="publisher-impact-heading">
        <h3
          id="publisher-impact-heading"
          className="px-0.5 text-sm font-semibold tracking-tight text-foreground"
        >
          {t('sections.impact.title')}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {impactStats.map((stat) => (
            <DavinciGlassStatBlock
              key={stat.label}
              value={stat.value}
              label={stat.label}
              hint={stat.hint}
            />
          ))}
        </div>
      </section>
    </div>
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <div className="min-h-full text-foreground relative transition-colors duration-300">
      <div className="flex min-h-full gap-3">
        <div className="ring-content-panel flex-1 min-w-0 pb-24 lg:pb-8">{children}</div>
        <div className="ring-right-rail hidden w-[300px] shrink-0 self-stretch min-h-0 lg:block">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}
