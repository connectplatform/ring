'use client'

// Imports for UI components, icons, i18n functions, and type definitions
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* HERO SECTION */}
      <section className="relative py-16 px-4 text-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto space-y-6">
          {/* "Sparkles" badge above title */}
          <Badge variant="secondary" className="px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-2 inline" />
            {t('hero.badge')}
          </Badge>
          {/* Main title and description */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{t('hero.title')}</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('hero.description')}
          </p>
          {/* Row of "outline" badges */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Badge variant="outline">{t('badges.openSource')}</Badge>
            <Badge variant="outline">{t('badges.community')}</Badge>
            <Badge variant="outline">{t('badges.modular')}</Badge>
          </div>
          {/* Display app/site name */}
          <p className="text-sm text-muted-foreground">{displayName}</p>
        </div>
      </section>

      {/* ORIGIN SECTION */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">{t('sections.origin.title')}</h2>
            <p className="text-muted-foreground">{t('sections.origin.subtitle')}</p>
          </div>
          <Callout type="info" title={t('sections.origin.title')}>
            {t('sections.origin.content')}
          </Callout>
        </div>
      </section>

      {/* FOUNDERS SECTION */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          {/* Details/Description column */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">{t('sections.founders.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('sections.founders.subtitle')}</p>
            <p className="text-muted-foreground leading-relaxed">{t('sections.founders.description')}</p>
            {/* Call-to-action button for founders page */}
            <Button asChild size="lg">
              <Link href="/about-publisher">
                <Heart className="w-4 h-4 mr-2" />
                {t('sections.founders.ctaLabel')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">{t('sections.founders.ctaHint')}</p>
          </div>
          {/* Card showing founder(s) details, or link if not present */}
          <Card className="border-primary/20 bg-card/80">
            <CardContent className="pt-6 space-y-4">
              {/* Conditional logic if a founder is present */}
              {primaryFounder ? (
                <>
                  <div className="space-y-1 text-center md:text-left">
                    <p className="text-sm font-medium text-primary">{t('sections.founders.contactTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('sections.founders.contactSubtitle')}</p>
                  </div>
                  {/* Render founder contact widget */}
                  <RingWidgetsContact {...primaryFounder} />
                </>
              ) : (
                <>
                  {/* If no founder, fallback with users icon and cta */}
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Users className="w-5 h-5" />
                    {t('sections.founders.title')}
                  </div>
                  <p className="text-sm text-muted-foreground">{t('sections.founders.ctaHint')}</p>
                  {/* Button linking to about-publisher */}
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/about-publisher">{t('sections.founders.ctaLabel')}</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* GOALS SECTION */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2">{t('sections.goals.title')}</h2>
            <p className="text-muted-foreground">{t('sections.goals.subtitle')}</p>
          </div>
          {/* List goals as cards for connect, opportunities, sovereignty */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {(['connect', 'opportunities', 'sovereignty'] as const).map((key) => (
              <Card key={key} className="h-full">
                <CardContent className="pt-6 space-y-3">
                  {/* Icon for each goal (Users/Target/Globe) */}
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {key === 'connect' ? (
                      <Users className="w-5 h-5 text-primary" />
                    ) : key === 'opportunities' ? (
                      <Target className="w-5 h-5 text-primary" />
                    ) : (
                      <Globe className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{t(`sections.goals.items.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`sections.goals.items.${key}.description`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Roadmap section, conditional on prop */}
          {roadmapEnabled ? (
            <Card className="border-dashed border-primary/40 bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Map className="w-5 h-5 text-primary" />
                    {t('sections.goals.roadmapTitle')}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    {t('sections.goals.roadmapDescription')}
                  </p>
                </div>
                <Button asChild>
                  <Link href="/roadmap">
                    <Compass className="w-4 h-4 mr-2" />
                    {t('sections.goals.roadmapCta')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {/* AUDIENCE & GETTING STARTED SECTION */}
      <section className="py-12 px-4 bg-muted/20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10">
          {/* Audience list */}
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('sections.audience.title')}</h2>
            <p className="text-muted-foreground mb-6">{t('sections.audience.subtitle')}</p>
            <ul className="space-y-3">
              {audienceItems.map((item) => (
                <li key={item} className="flex gap-2 text-muted-foreground text-sm leading-relaxed">
                  <Rocket className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Getting started ordered list */}
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('sections.gettingStarted.title')}</h2>
            <p className="text-muted-foreground mb-6">{t('sections.gettingStarted.subtitle')}</p>
            <ol className="space-y-3 list-decimal list-inside text-sm text-muted-foreground">
              {gettingStartedSteps.map((step) => (
                <li key={step} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CAPABILITIES / FINAL ACTIONS SECTION */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold">{t('sections.capabilities.title')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('sections.capabilities.description')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {/* Contact & Documentation actions */}
            <Button variant="outline" asChild>
              <Link href="/contact">{t('actions.contact')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/docs">
                <BookOpen className="w-4 h-4 mr-2" />
                {t('actions.documentation')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

// TODO: Use React 19 use() hook for translations if next-intl supports React 19's new hooks API.
// TODO: Consider using React 19's <Suspense> and async/await for data fetching if translation or data comes async.
// TODO: If using Next.js 13+ use server components where possible for static sections and hydrate dynamic props only in client.
// TODO: Inline mapping and duplicate <Badge> and <Button> markup may be further DRYed with a config array or extracted subcomponents.