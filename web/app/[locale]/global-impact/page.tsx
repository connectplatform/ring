import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { buildMessages } from '@/lib/i18n'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

import { Callout } from '@/components/docs/callout'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import RingLogoWithFlag from '@/components/common/widgets/ring-logo-with-flag'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

/** Horizontal inset for text/CTAs — bands themselves stay edge-to-edge. */
const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

const iconCircle =
  'mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]'

type Props = {
  params: Promise<{ locale: string }>
}

type Msg = Record<string, any>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'global-impact',
    pathname: '/global-impact',
  })
}

export default async function GlobalImpactPage({ params }: Props) {
  await connection()

  const { locale: localeParam } = await params
  if (!routing.locales.includes(localeParam as Locale)) {
    notFound()
  }
  const locale = localeParam as Locale
  setRequestLocale(locale)

  const messages = await buildMessages(locale)
  const t = (messages['global-impact'] || {}) as Msg

  const effectKeys = [
    { key: 'sovereignty' as const, emoji: '◎' },
    { key: 'focus' as const, emoji: '◈' },
    { key: 'economy' as const, emoji: '⇄' },
    { key: 'peace' as const, emoji: '✦' },
    { key: 'replication' as const, emoji: '⧉' },
    { key: 'education' as const, emoji: '◇' },
  ]

  return (
    <AboutWrapper locale={locale}>
      <div className="w-full min-w-0">
        <section className={cn('relative overflow-hidden text-center', BAND_Y)}>
          <div
            className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]"
            aria-hidden
          />
          <div className={cn('relative mx-auto max-w-4xl space-y-6', INSET)}>
            <DavinciGlassChip>{t.badge}</DavinciGlassChip>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t.hero?.title}
            </h1>
            <p className="mx-auto max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              {t.hero?.subtitle}
            </p>
          </div>
        </section>

        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.thesis?.title}</h2>
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div className="space-y-5">
                <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {t.thesis?.description}
                </p>
                <Callout type="info">{t.thesis?.quote}</Callout>
              </div>
              <div className="relative">
                <RingLogoWithFlag />
              </div>
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.effects?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.effects?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {effectKeys.map(({ key, emoji }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <div className={iconCircle}>
                    <span className="text-sm font-semibold text-[var(--davinci-beam)]" aria-hidden>
                      {emoji}
                    </span>
                  </div>
                  <h3 className="mb-2 text-center text-base font-semibold sm:text-lg">
                    {t.effects?.[key]?.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.effects?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.howItWorks?.title}</h2>
            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 sm:p-6')}>
              <Steps>
                {(['step1', 'step2', 'step3', 'step4'] as const).map((key) => (
                  <Step key={key}>
                    <h3 className="mb-1.5 text-base font-semibold sm:text-lg">
                      {t.howItWorks?.[key]?.title}
                    </h3>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      {t.howItWorks?.[key]?.description}
                    </p>
                  </Step>
                ))}
              </Steps>
            </div>
          </div>
        </section>

        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-2xl text-center', INSET)}>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.cta?.title}</h2>
            <p className="mb-8 text-base text-muted-foreground sm:text-lg">{t.cta?.subtitle}</p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`/${locale}/about-publisher`}
                className={cn(
                  davinciCtaPrimary,
                  'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                )}
              >
                {t.cta?.learnMore}
              </a>
              <a
                href={`/${locale}/docs/getting-started`}
                className={cn(
                  davinciGlassSurface,
                  'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                )}
              >
                {t.cta?.getStarted}
              </a>
            </div>
          </div>
        </section>
      </div>
    </AboutWrapper>
  )
}
