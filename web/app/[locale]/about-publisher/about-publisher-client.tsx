'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/docs/callout'
import { RingWidgetsContact } from '@/components/ring-widgets/contact'
import type { RingWidgetsContactProps } from '@/lib/ring-widgets/contact-schema'
import {
  Heart,
  Users,
  Globe,
  Code,
  Target,
  Sparkles,
  MapPin,
  Award,
  BookIcon,
} from 'lucide-react'
import { GithubIcon } from '@/components/ui/icons/github-icon'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  DavinciGlassStatBlock,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

/** Horizontal inset for text/CTAs — bands themselves stay edge-to-edge. */
const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

export type AboutPublisherClientProps = {
  primaryFounder: RingWidgetsContactProps | null
}

export function AboutPublisherClient({ primaryFounder }: AboutPublisherClientProps) {
  const t = useTranslations('about-publisher')

  const impactStats = [
    {
      value: t.has('sections.impact.stats.deploymentsValue')
        ? t('sections.impact.stats.deploymentsValue')
        : '50+',
      label: t('sections.impact.stats.deployments'),
    },
    {
      value: t.has('sections.impact.stats.valueValue')
        ? t('sections.impact.stats.valueValue')
        : '€500M+',
      label: t('sections.impact.stats.value'),
    },
    {
      value: t.has('sections.impact.stats.benefitingValue')
        ? t('sections.impact.stats.benefitingValue')
        : '2.5M+',
      label: t('sections.impact.stats.benefiting'),
    },
    {
      value: t.has('sections.impact.stats.countriesValue')
        ? t('sections.impact.stats.countriesValue')
        : '40+',
      label: t('sections.impact.stats.countries'),
    },
  ] as const

  return (
    <div className="w-full min-w-0">
      {/* Hero — full-bleed tint */}
      <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
          aria-hidden
        />
        <div className={cn('relative mx-auto max-w-4xl space-y-6', INSET)}>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {t('title')}
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t('hero.description')}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <DavinciGlassChip icon={<Code className="h-3 w-3" />}>{t('badges.openSource')}</DavinciGlassChip>
            <DavinciGlassChip icon={<Sparkles className="h-3 w-3" />}>{t('badges.aiPowered')}</DavinciGlassChip>
            <DavinciGlassChip icon={<Globe className="h-3 w-3" />}>{t('badges.weaponOfPeace')}</DavinciGlassChip>
          </div>
        </div>
      </section>

      {/* Origin */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('sections.origin.title')}</h2>
            <p className="text-base text-muted-foreground sm:text-lg">{t('sections.origin.subtitle')}</p>
          </div>
          <div className="space-y-5">
            {(
              [
                { key: 'crisis' as const, Icon: MapPin, iconClass: undefined as string | undefined },
                { key: 'liberation' as const, Icon: Target, iconClass: undefined as string | undefined },
                { key: 'gratitude' as const, Icon: Heart, iconClass: 'text-red-500' },
              ]
            ).map(({ key, Icon, iconClass }) => (
              <div key={key} className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
                <h3 className="mb-2 flex items-center text-lg font-semibold sm:text-xl">
                  <Icon
                    className={cn(
                      'mr-2.5 h-5 w-5 shrink-0 text-[var(--davinci-beam)]',
                      iconClass,
                    )}
                  />
                  {t(`sections.origin.stories.${key}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t(`sections.origin.stories.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission — full-bleed band */}
      <section
        className={cn(
          BAND_Y,
          'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
        )}
      >
        <div className={cn('mx-auto max-w-4xl', INSET)}>
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('sections.mission.title')}</h2>
            <p className="text-base text-muted-foreground sm:text-lg">{t('sections.mission.subtitle')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                { key: 'unite' as const, Icon: Users },
                { key: 'democratize' as const, Icon: Sparkles },
                { key: 'endDeficit' as const, Icon: Target },
              ] as const
            ).map(({ key, Icon }) => (
              <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 text-center')}>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]">
                  <Icon className="h-5 w-5 text-[var(--davinci-beam)]" />
                </div>
                <h3 className="mb-2 text-base font-semibold sm:text-lg">
                  {t(`sections.mission.cards.${key}.title`)}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {t(`sections.mission.cards.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Callout type="info">
              <strong>{t('sections.mission.visionLabel')}</strong> {t('sections.mission.vision')}
            </Callout>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('sections.impact.title')}</h2>
            <p className="text-base text-muted-foreground sm:text-lg">{t('sections.impact.subtitle')}</p>
          </div>

          <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {impactStats.map((stat) => (
              <DavinciGlassStatBlock
                key={stat.label}
                value={stat.value}
                label={stat.label}
                hint=""
                beamOnHover={false}
                className="min-w-0"
              />
            ))}
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t('sections.impact.stories.title')}</h3>
              {(['story1', 'story2', 'story3'] as const).map((key) => (
                <div key={key} className={cn(davinciGlassSurface, 'p-3.5')}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--davinci-beam)]" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">
                        {t(`sections.impact.stories.${key}.name`)}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {t(`sections.impact.stories.${key}.description`)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{t('sections.impact.democratization.title')}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t('sections.impact.democratization.description')}
              </p>
              <div
                className={cn(
                  davinciGlassSurface,
                  'border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)] p-4',
                )}
              >
                <p className="text-sm italic text-muted-foreground">
                  {t('sections.impact.democratization.quote')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future — full-bleed band */}
      <section
        className={cn(
          BAND_Y,
          'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
        )}
      >
        <div className={cn('mx-auto max-w-4xl text-center', INSET)}>
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">{t('sections.future.title')}</h2>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('sections.future.description')}
          </p>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {(
              [
                { key: 'autonomous' as const, emoji: '🤖' },
                { key: 'learning' as const, emoji: '🌐' },
                { key: 'adaptation' as const, emoji: '⚡' },
              ] as const
            ).map(({ key, emoji }) => (
              <div key={key} className={cn(davinciGlassSurface, 'p-4')}>
                <div className="mb-3 text-3xl" aria-hidden>
                  {emoji}
                </div>
                <h3 className="mb-1.5 text-base font-semibold">
                  {t(`sections.future.features.${key}.title`)}
                </h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {t(`sections.future.features.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
          <Callout type="success">
            <strong>{t('sections.future.roadmapLabel')}</strong> {t('sections.future.roadmap')}
          </Callout>
        </div>
      </section>

      {/* CTA — inset so buttons respect pane padding */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t('thankYou.title')}</h2>
          <p className="mb-6 text-base text-muted-foreground sm:text-lg">{t('thankYou.subtitle')}</p>
          <p className="mx-auto mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('thankYou.description')}
          </p>

          {primaryFounder ? (
            <div className="mx-auto mb-8 max-w-lg space-y-3 text-left">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-semibold">{t('founders.contactTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('founders.contactSubtitle')}</p>
              </div>
              <RingWidgetsContact {...primaryFounder} />
            </div>
          ) : null}

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link href="/docs/deployment/quick-start">
                <BookIcon className="mr-2 h-4 w-4" />
                {t('actions.cloneRing')}
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/token-economy">
                <Award className="mr-2 h-4 w-4" />
                {t('actions.learnTokens')}
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://github.com/connectplatform/ring"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="mr-2 h-4 w-4" />
                {t('actions.viewSource')}
              </a>
            </Button>
          </div>

          <div className={cn(davinciGlassSurface, 'mt-12 p-6')}>
            <div className="mb-3 flex items-center justify-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="text-base font-medium">{t('thankYou.slogan')}</span>
              <Heart className="h-5 w-5 text-red-500" />
            </div>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{t('thankYou.message')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
