import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { buildMessages } from '@/lib/i18n'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { Steps, Step } from '@/components/docs/steps'
import AboutWrapper from '@/components/wrappers/about-wrapper'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

/** Horizontal inset for text/CTAs — bands stay edge-to-edge. */
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
    path: 'token-economy',
    pathname: '/token-economy',
  })
}

export default async function TokenEconomyPage({ params }: Props) {
  await connection()

  const { locale: localeParam } = await params
  if (!routing.locales.includes(localeParam as Locale)) {
    notFound()
  }
  const locale = localeParam as Locale
  setRequestLocale(locale)

  const messages = await buildMessages(locale)
  const t = (messages['tokenomics'] || {}) as Msg

  const layerKeys = [
    { key: 'credit' as const, mark: '1' },
    { key: 'native' as const, mark: '2' },
    { key: 'rails' as const, mark: '3' },
  ]

  const deskKeys = [
    { key: 'oracle' as const },
    { key: 'firstSettler' as const },
    { key: 'quotes' as const },
  ]

  const rewardKeys = [
    { key: 'profile' as const },
    { key: 'contribution' as const },
    { key: 'caps' as const },
  ]

  const utilityKeys = [
    { key: 'membership' as const },
    { key: 'store' as const },
    { key: 'send' as const },
    { key: 'dao' as const },
  ]

  const nftKeys = [
    { key: 'primary' as const },
    { key: 'secondary' as const },
    { key: 'why' as const },
  ]

  const principleKeys = [
    { key: 'utilityFirst' as const },
    { key: 'cloneBranding' as const },
    { key: 'ownOracle' as const },
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

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.layers?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.layers?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {layerKeys.map(({ key, mark }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <div className={iconCircle}>
                    <span className="text-sm font-bold text-[var(--davinci-beam)]">{mark}</span>
                  </div>
                  <h3 className="mb-2 text-center text-base font-semibold sm:text-lg">
                    {t.layers?.[key]?.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {t.layers?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.desk?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.desk?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {deskKeys.map(({ key }) => (
                <div key={key} className={cn(davinciGlassSurface, 'p-4')}>
                  <h3 className="mb-2 text-base font-semibold">{t.desk?.[key]?.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.desk?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.rewards?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.rewards?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {rewardKeys.map(({ key }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <h3 className="mb-2 text-base font-semibold">{t.rewards?.[key]?.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.rewards?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.utility?.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {utilityKeys.map(({ key }) => (
                <div key={key} className={cn(davinciGlassSurface, 'p-4 sm:p-5')}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold sm:text-lg">{t.utility?.[key]?.title}</h3>
                    {t.utility?.[key]?.note ? (
                      <span className="text-xs font-medium tabular-nums text-[var(--davinci-beam)]">
                        {t.utility[key].note}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.utility?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.nftRwa?.title}</h2>
              <p className="mx-auto max-w-3xl text-base text-muted-foreground sm:text-lg">
                {t.nftRwa?.subtitle}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {nftKeys.map(({ key }) => (
                <div key={key} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
                  <h3 className="mb-2 text-base font-semibold">{t.nftRwa?.[key]?.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t.nftRwa?.[key]?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={cn(
            BAND_Y,
            'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_80%,hsl(var(--muted)))]',
          )}
        >
          <div className={cn('mx-auto max-w-5xl', INSET)}>
            <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{t.principles?.title}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {principleKeys.map(({ key }) => (
                <div key={key} className={cn(davinciGlassSurface, 'p-4 text-center')}>
                  <h3 className="mb-2 text-base font-semibold sm:text-lg">
                    {t.principles?.[key]?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t.principles?.[key]?.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-3xl">
            <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-6 sm:p-8')}>
              <h2 className="mb-6 text-center text-2xl font-bold sm:text-3xl">
                {t.gettingStarted?.title}
              </h2>
              <Steps>
                {(['step1', 'step2', 'step3'] as const).map((key) => (
                  <Step key={key}>
                    <h3 className="text-base font-semibold sm:text-lg">
                      {t.gettingStarted?.[key]?.title}
                    </h3>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      {t.gettingStarted?.[key]?.description}
                    </p>
                  </Step>
                ))}
              </Steps>
            </div>
          </div>
        </section>

        <section className={cn(BAND_Y, INSET)}>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t.cta?.title}</h2>
            <p className="mb-8 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.cta?.subtitle}
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href={`/${locale}/wallet`}
                className={cn(
                  davinciCtaPrimary,
                  'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                )}
              >
                {t.cta?.getRing}
              </a>
              <a
                href={`/${locale}/docs/customization/token-economics`}
                className={cn(
                  davinciGlassSurface,
                  'inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold sm:text-base',
                )}
              >
                {t.cta?.learnMore}
              </a>
            </div>
          </div>
        </section>
      </div>
    </AboutWrapper>
  )
}
