'use client'

// Imports for UI components, icons, i18n functions, and type definitions
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/docs/callout'
import { Link } from '@/i18n/routing'
import { RingWidgetsContact } from '@/components/ring-widgets/contact'
import type { RingWidgetsContactProps } from '@/lib/ring-widgets/contact-schema'
import {
  BookOpen,
  Compass,
  Globe,
  Map,
  Rocket,
  Sparkles,
  Target,
  Users,
  ArrowRight,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

/** Horizontal inset for text/CTAs — bands themselves stay edge-to-edge. */
const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

/** Beam-tint icon circle shared by goal cards. */
const iconCircle =
  'mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]'

// Prop types describing the AboutClient component
export type AboutClientProps = {
  roadmapEnabled: boolean           // Whether to show the roadmap section
  displayName: string              // App or site display name
  primaryFounder: RingWidgetsContactProps | null // Object for founder (if exists)
}

// Main functional component rendered on the client
export function AboutClient({ roadmapEnabled, displayName, primaryFounder }: AboutClientProps) {
  const t = useTranslations('about') // Translation function for the 'about' namespace
  // Extract audience list and getting started steps from translations
  const audienceItems = t.raw('sections.audience.items') as string[]
  const gettingStartedSteps = t.raw('sections.gettingStarted.steps') as string[]

  return (
    <div className="w-full min-w-0">
      {/* HERO — full-bleed tint */}
      <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
        <div
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
          aria-hidden
        />
        <div className={cn('relative mx-auto max-w-4xl space-y-6', INSET)}>
          <DavinciGlassChip icon={<Sparkles className="h-3 w-3" />}>{t('hero.badge')}</DavinciGlassChip>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t('hero.description')}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <DavinciGlassChip>{t('badges.openSource')}</DavinciGlassChip>
            <DavinciGlassChip>{t('badges.community')}</DavinciGlassChip>
            <DavinciGlassChip>{t('badges.modular')}</DavinciGlassChip>
          </div>
          <p className="text-sm text-muted-foreground">{displayName}</p>
        </div>
      </section>

      {/* ORIGIN */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t('sections.origin.title')}</h2>
            <p className="text-base text-muted-foreground sm:text-lg">{t('sections.origin.subtitle')}</p>
          </div>
          <Callout type="info" title={t('sections.origin.title')}>
            {t('sections.origin.content')}
          </Callout>
        </div>
      </section>

      {/* FOUNDERS — full-bleed band */}
      <section
        className={cn(
          BAND_Y,
          'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
        )}
      >
        <div className={cn('mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-2', INSET)}>
          {/* Details/Description column */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('sections.founders.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('sections.founders.subtitle')}</p>
            <p className="leading-relaxed text-muted-foreground">{t('sections.founders.description')}</p>
            {/* Call-to-action button for founders page */}
            <Button asChild size="lg">
              <Link href="/about-publisher">
                <Heart className="mr-2 h-4 w-4" />
                {t('sections.founders.ctaLabel')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">{t('sections.founders.ctaHint')}</p>
          </div>
          {/* Glass surface showing founder(s) details, or fallback link */}
          <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'space-y-4 p-4 sm:p-5')}>
            {primaryFounder ? (
              <>
                <div className="space-y-1 text-center md:text-left">
                  <p className="text-sm font-medium text-[var(--davinci-beam)]">
                    {t('sections.founders.contactTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('sections.founders.contactSubtitle')}</p>
                </div>
                <RingWidgetsContact {...primaryFounder} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-medium text-[var(--davinci-beam)]">
                  <Users className="h-5 w-5" />
                  {t('sections.founders.title')}
                </div>
                <p className="text-sm text-muted-foreground">{t('sections.founders.ctaHint')}</p>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/about-publisher">{t('sections.founders.ctaLabel')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* GOALS */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold sm:text-3xl">{t('sections.goals.title')}</h2>
            <p className="text-base text-muted-foreground sm:text-lg">{t('sections.goals.subtitle')}</p>
          </div>
          {/* List goals as glass cards for connect, opportunities, sovereignty */}
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {(
              [
                { key: 'connect' as const, Icon: Users },
                { key: 'opportunities' as const, Icon: Target },
                { key: 'sovereignty' as const, Icon: Globe },
              ] as const
            ).map(({ key, Icon }) => (
              <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 text-center')}>
                <div className={iconCircle}>
                  <Icon className="h-5 w-5 text-[var(--davinci-beam)]" />
                </div>
                <h3 className="mb-2 text-base font-semibold sm:text-lg">
                  {t(`sections.goals.items.${key}.title`)}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {t(`sections.goals.items.${key}.description`)}
                </p>
              </div>
            ))}
          </div>

          {/* Roadmap teaser, conditional on prop */}
          {roadmapEnabled ? (
            <div
              className={cn(
                davinciGlassSurface,
                'border-dashed border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)] p-4 sm:p-5',
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Map className="h-5 w-5 text-[var(--davinci-beam)]" />
                    {t('sections.goals.roadmapTitle')}
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {t('sections.goals.roadmapDescription')}
                  </p>
                </div>
                <Button asChild>
                  <Link href="/roadmap">
                    <Compass className="mr-2 h-4 w-4" />
                    {t('sections.goals.roadmapCta')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* AUDIENCE & GETTING STARTED — full-bleed band */}
      <section
        className={cn(
          BAND_Y,
          'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
        )}
      >
        <div className={cn('mx-auto grid max-w-4xl gap-10 md:grid-cols-2', INSET)}>
          {/* Audience list */}
          <div>
            <h2 className="mb-2 text-xl font-bold sm:text-2xl">{t('sections.audience.title')}</h2>
            <p className="mb-6 text-muted-foreground">{t('sections.audience.subtitle')}</p>
            <ul className="space-y-3">
              {audienceItems.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-[var(--davinci-beam)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Getting started ordered list */}
          <div>
            <h2 className="mb-2 text-xl font-bold sm:text-2xl">{t('sections.gettingStarted.title')}</h2>
            <p className="mb-6 text-muted-foreground">{t('sections.gettingStarted.subtitle')}</p>
            <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
              {gettingStartedSteps.map((step) => (
                <li key={step} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CAPABILITIES / FINAL ACTIONS — inset so CTAs respect pane padding */}
      <section className={cn(BAND_Y, INSET)}>
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t('sections.capabilities.title')}</h2>
          <p className="leading-relaxed text-muted-foreground">{t('sections.capabilities.description')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {/* Contact & Documentation actions */}
            <Button variant="outline" asChild>
              <Link href="/contact">{t('actions.contact')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">
                <BookOpen className="mr-2 h-4 w-4" />
                {t('actions.documentation')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
