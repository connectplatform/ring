import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { LocalePageProps } from '@/utils/page-props'
import { ROUTES } from '@/constants/routes'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { safePostAuthRedirect } from '@/lib/auth/safe-post-auth-redirect'
import { getCreditUnitLabel } from '@/lib/ring-config-core'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import VitalsOnboardingClient from '@/features/auth/components/vitals-onboarding-client'
import type { VitalsRewardHint } from '@/features/auth/components/vitals-onboarding-form'

type OnboardingParams = Record<string, never>

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value[0]) return value[0]
  return undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'auth.login',
    pathname: '/login/onboarding',
    robots: { index: false, follow: false },
  })
}

function buildRewardHints(): VitalsRewardHint[] {
  const credit = getSystemConfigSnapshot().credit as
    | {
        rewards?: {
          events?: Record<string, { amount?: string; enabled?: boolean }>
        }
      }
    | undefined
  const events = credit?.rewards?.events || {}
  const keys: Array<{ event: string; labelKey: string }> = [
    { event: 'profileCompleted', labelKey: 'profileCompleted' },
    { event: 'addedBio', labelKey: 'addedBio' },
    { event: 'ringUsername', labelKey: 'ringUsername' },
  ]
  const hints: VitalsRewardHint[] = []
  for (const { event, labelKey } of keys) {
    const cfg = events[event]
    if (!cfg?.enabled) continue
    hints.push({
      event,
      amount: String(cfg.amount ?? '0'),
      label: labelKey,
    })
  }
  return hints
}

export default async function LoginOnboardingPage(props: LocalePageProps<OnboardingParams>) {
  await connection()

  const params = await props.params
  const searchParams = await props.searchParams
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const rawFrom =
    searchParams.from ?? searchParams.callbackUrl ?? searchParams.returnTo
  const from = firstSearchParam(
    typeof rawFrom === 'string' || Array.isArray(rawFrom) ? rawFrom : undefined,
  )
  const callbackTarget = safePostAuthRedirect(from, locale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.LOGIN_ONBOARDING(locale))}`,
    )
  }

  if (!session.user.needsOnboarding) {
    redirect(callbackTarget)
  }

  const t = await getTranslations('modules.auth.onboarding')
  const creditBalanceUnitLabel = getCreditUnitLabel()
  const rawHints = buildRewardHints()
  const rewardHints: VitalsRewardHint[] = rawHints.map((h) => ({
    ...h,
    label: t(`rewardLabels.${h.label}` as 'rewardLabels.profileCompleted'),
  }))

  return (
    <div className="min-h-[100dvh] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full">
        <VitalsOnboardingClient
          creditBalanceUnitLabel={creditBalanceUnitLabel}
          rewardHints={rewardHints}
          callbackUrl={callbackTarget}
        />
      </div>
    </div>
  )
}
