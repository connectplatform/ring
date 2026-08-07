'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Coins,
  Map,
  Newspaper,
  Wallet,
} from 'lucide-react'
import { GithubIcon } from '@/components/ui/icons/github-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { APP_VERSION, formatAppVersionLabel } from '@/lib/app-version'
import { buildJourney, type FutureMilestone } from '@/lib/roadmap/build-journey'
import type { ChangelogEntry } from '@/lib/changelog/types'
import {
  RocketJourneyWidget,
  type RocketJourneyLabels,
} from '@/components/roadmap/rocket-journey-widget'
import { ROUTES } from '@/constants/routes'
import { Link, toAppHref } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

type DocLink = { title: string; description: string; href: string }

const DOC_LINK_ICONS = [BookOpen, Newspaper, Coins] as const

export type RoadmapPageProps = {
  changelog: ChangelogEntry[]
}

export function RoadmapPage({ changelog }: RoadmapPageProps) {
  const t = useTranslations('roadmap')
  const locale = useLocale() as Locale
  const versionLabel = formatAppVersionLabel(APP_VERSION)

  const futureMilestones = (t.raw('futureMilestones') as FutureMilestone[]) || []
  const docLinks = (t.raw('docs.links') as DocLink[]) || []

  const journeyLabels: RocketJourneyLabels = {
    nowLabel: t('journey.nowLabel'),
    changelogCta: t('journey.changelogCta'),
    githubCta: t('journey.githubCta'),
    ringdomCta: t('journey.ringdomCta'),
    futureBadge: t('journey.futureBadge'),
    inProgressBadge: t('journey.inProgressBadge'),
    plannedBadge: t('journey.plannedBadge'),
    dragHint: t('journey.dragHint'),
    empty: t('journey.empty'),
    axisFuture: t('journey.axisFuture'),
    axisPast: t('journey.axisPast'),
  }

  const nodes = useMemo(
    () =>
      buildJourney({
        changelog,
        futureMilestones,
        nowLabel: t('journey.nowLabel'),
        currentVersionFallback: APP_VERSION,
      }),
    [changelog, futureMilestones, t],
  )

  return (
    <div className="w-full min-w-0">
      <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
          aria-hidden
        />
        <div className={cn('relative mx-auto max-w-5xl space-y-6', INSET)}>
          <div className="flex justify-center">
            <DavinciGlassChip icon={<Map className="h-3 w-3" />}>{versionLabel}</DavinciGlassChip>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{t('title')}</h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href={toAppHref(ROUTES.TOKEN_ECONOMY(locale))}>
                <Coins className="mr-2 h-4 w-4" />
                {t('hero.ringCta')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={toAppHref(ROUTES.WALLET(locale))}>
                <Wallet className="mr-2 h-4 w-4" />
                {t('hero.walletCta')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="https://github.com/connectplatform/ring" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="mr-2 h-4 w-4" />
                {t('hero.cloneCta')}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="text-center">
            <h2 className="mb-2 text-3xl font-bold">{t('timeline.title')}</h2>
            <p className="text-muted-foreground">{t('timeline.subtitle')}</p>
          </div>
          <RocketJourneyWidget nodes={nodes} labels={journeyLabels} locale={locale} />
        </div>
      </section>

      {docLinks.length > 0 ? (
        <motion.section
          className={cn(BAND_Y, INSET)}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-3 text-3xl font-bold">{t('docs.title')}</h2>
              <p className="text-muted-foreground">{t('docs.subtitle')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docLinks.map((link, index) => {
                const Icon = DOC_LINK_ICONS[index % DOC_LINK_ICONS.length]!
                const cardClass = cn(
                  davinciGlassSurface,
                  davinciBeamInnerSurface,
                  'flex h-full flex-col gap-2 p-4 transition-transform hover:-translate-y-0.5',
                )
                const body = (
                  <>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[var(--davinci-beam)]" />
                      <span className="font-semibold">{link.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--davinci-beam)]">
                      {t('docs.cta')}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </>
                )
                if (link.href.startsWith('http')) {
                  return (
                    <motion.div key={link.href} variants={itemVariants}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cardClass}
                      >
                        {body}
                      </a>
                    </motion.div>
                  )
                }
                const href = toAppHref(link.href.startsWith('/') ? link.href : `/${link.href}`)
                return (
                  <motion.div key={link.href} variants={itemVariants}>
                    <Link href={href} className={cardClass}>
                      {body}
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.section>
      ) : null}

      <section className={cn(BAND_Y, INSET, 'text-center')}>
        <Badge variant="secondary" className="mb-3">
          {versionLabel}
        </Badge>
        <div>
          <Button asChild variant="outline">
            <Link href={toAppHref(ROUTES.DOCS(locale))}>
              {t('docs.cta')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
