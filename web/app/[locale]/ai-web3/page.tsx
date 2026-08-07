import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { buildMessages, getMessageSection } from '@/lib/i18n'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'

import AboutWrapper from '@/components/wrappers/about-wrapper'
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'ai-web3',
    pathname: '/ai-web3',
  })
}

type Msg = Record<string, any>

export default async function AIWeb3Page({ params }: Props) {
  await connection()

  const { locale: localeParam } = await params
  if (!routing.locales.includes(localeParam as Locale)) {
    notFound()
  }
  const locale = localeParam as Locale
  setRequestLocale(locale)

  const messages = await buildMessages(locale, 'public')
  const t = getMessageSection(messages, 'ai-web3') as Msg

  const flowItems = [
    { key: 'rewards' as const, emoji: '◎' },
    { key: 'sponsored' as const, emoji: '⟡' },
    { key: 'desk' as const, emoji: '⇄' },
  ]

  const featureItems = [
    { key: 'send' as const, emoji: '↗' },
    { key: 'nftGate' as const, emoji: '⬡' },
    { key: 'nftMarket' as const, emoji: '◫' },
    { key: 'microDao' as const, emoji: '◎' },
    { key: 'matching' as const, emoji: '◈' },
  ]

  const archItems = [
    { key: 'walletConductor' as const, emoji: '1' },
    { key: 'creditLedger' as const, emoji: '2' },
    { key: 'solana' as const, emoji: '3' },
    { key: 'integration' as const, emoji: '4' },
  ]

  const journeySteps = [
    { key: 'step1' as const },
    { key: 'step2' as const },
    { key: 'step3' as const },
  ]

  return (
    <AboutWrapper locale={locale}>
      <div className="w-full min-w-0">
        {/* Hero */}
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

        {/* Pillars — AI + money stack */}
        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.pillars?.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  { key: 'ai' as const, emoji: '◈' },
                  { key: 'web3' as const, emoji: '◎' },
                ] as const
              ).map(({ key, emoji }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 sm:p-5')}>
                  <div className={cn(iconCircle, 'mx-0')}>
                    <span className="text-sm font-semibold text-[var(--davinci-beam)]" aria-hidden>
                      {emoji}
                    </span>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold sm:text-xl">{t.pillars?.[key]?.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t.pillars?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core money flows — full-bleed */}
        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.flows?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.flows?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {flowItems.map(({ key, emoji }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <div className={iconCircle}>
                    <span className="text-sm font-semibold text-[var(--davinci-beam)]" aria-hidden>
                      {emoji}
                    </span>
                  </div>
                  <h3 className="mb-2 text-center text-base font-semibold sm:text-lg">
                    {t.flows?.[key]?.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {t.flows?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Member actions */}
        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.features?.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featureItems.map(({ key, emoji }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <div className={cn(iconCircle, 'mx-0')}>
                    <span className="text-sm font-semibold text-[var(--davinci-beam)]" aria-hidden>
                      {emoji}
                    </span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold sm:text-lg">{t.features?.[key]?.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.features?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture — full-bleed */}
        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.architecture?.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {archItems.map(({ key, emoji }) => (
                <div key={key} className={cn(davinciGlassSurface, 'p-4')}>
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] text-xs font-bold text-[var(--davinci-beam)]">
                    {emoji}
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold">{t.architecture?.[key]?.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {t.architecture?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Typical journey */}
        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.journey?.title}</h2>
              <p className="text-base text-muted-foreground sm:text-lg">{t.journey?.subtitle}</p>
            </div>
            <ol className="space-y-4">
              {journeySteps.map(({ key }, index) => (
                <li key={key} className={cn(davinciGlassSurface, 'flex gap-4 p-4 sm:p-5')}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] text-sm font-bold text-[var(--davinci-beam)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="mb-1 text-base font-semibold sm:text-lg">{t.journey?.[key]?.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t.journey?.[key]?.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-3xl text-center">
            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-6 sm:p-8')}>
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.gettingStarted?.title}</h2>
              <p className="mb-6 text-base text-muted-foreground sm:text-lg">
                {t.gettingStarted?.subtitle}
              </p>
              <ul className="mx-auto mb-8 max-w-xl space-y-2 text-left text-sm text-muted-foreground">
                {(['step1', 'step2', 'step3'] as const).map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--davinci-beam)]"
                      aria-hidden
                    />
                    <span>{t.gettingStarted?.[key]}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={`/${locale}/wallet`}
                  className={cn(
                    davinciCtaPrimary,
                    'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                  )}
                >
                  {t.gettingStarted?.ctaWallet}
                </a>
                <a
                  href={`/${locale}/nft/market`}
                  className={cn(
                    davinciGlassSurface,
                    'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                  )}
                >
                  {t.gettingStarted?.ctaNft}
                </a>
                <a
                  href={`/${locale}/dao`}
                  className={cn(
                    davinciGlassSurface,
                    'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                  )}
                >
                  {t.gettingStarted?.ctaDao || 'MicroDAO'}
                </a>
                <a
                  href={`/${locale}/docs/features/wallet`}
                  className={cn(
                    davinciGlassSurface,
                    'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                  )}
                >
                  {t.gettingStarted?.ctaDocs}
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AboutWrapper>
  )
}
