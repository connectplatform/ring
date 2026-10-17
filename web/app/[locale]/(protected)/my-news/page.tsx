import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { after, connection } from 'next/server'
import { auth } from '@/auth'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { MyNewsClient } from './my-news-client'
import { logger } from '@/lib/logger'
import { getSiteBaseUrl } from '@/lib/ring-config-core'
import { getUserById } from '@/features/auth/services/get-user-by-id'
import { CurtainFunnelCard } from '@/features/curtain/components/curtain-funnel-card'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'

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
  const t = await getTranslations('news')
  return {
    title: t('myNews'),
    description: t('myNewsDescription'),
    robots: { index: false, follow: false },
  }
}

export default async function MyNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  setRequestLocale(validLocale)

  const session = await auth()
  if (!session?.user) return null

  after(async () => {
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user!.id)
      if (!userExists) {
        await userMigrationService.ensureUserDocument(session.user as Parameters<
          typeof userMigrationService.ensureUserDocument
        >[0])
      }
    } catch (migrationError) {
      logger.error('MyNewsPage: Failed to check/create user document:', migrationError)
    }
  })

  const t = await getTranslations('news')

  // Prefer JWT username; fall back to DB (username set after login may lag in session)
  let username =
    typeof session.user.username === 'string' ? session.user.username.trim() : ''
  if (!username) {
    try {
      const profile = await getUserById(session.user.id)
      const fromDb =
        typeof profile?.username === 'string' ? profile.username.trim() : ''
      username = fromDb.replace(/^@/, '')
    } catch (error) {
      logger.warn('MyNewsPage: failed to resolve username from DB', { error })
    }
  } else {
    username = username.replace(/^@/, '')
  }

  const curtainT = await getTranslations('modules.curtain')
  const { getCurtainFunnel } = await import('@/features/analytics/lib/curtain-analytics')
  const curtainFunnel = await getCurtainFunnel({
    timeframe: '7d',
    authorUserId: session.user.id,
  })
  let curtainCredits = '0.00'
  try {
    const history = await creditBalanceService.getCreditHistory(session.user.id, { limit: 100 })
    const total = history.transactions
      .filter((row) => String(row.reference_id || '').startsWith('curtain_author:'))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0)
    curtainCredits = total.toFixed(2)
  } catch (error) {
    logger.warn('MyNewsPage: curtain credit history skipped', { error })
  }

  return (
    <>
    <div className="container mx-auto px-6 pt-6 max-w-6xl">
      <CurtainFunnelCard
        title={curtainT('funnelTitle')}
        funnel={curtainFunnel}
        credits={curtainCredits}
        labels={{
          shown: curtainT('funnelShown'),
          resurfaced: curtainT('funnelResurfaced'),
          cta: curtainT('funnelCta'),
          notToday: curtainT('funnelNotToday'),
          notForMe: curtainT('funnelNotForMe'),
          scroll: curtainT('funnelScroll'),
          paid: curtainT('funnelPaid'),
          credits: curtainT('funnelCredits'),
        }}
      />
    </div>
    <MyNewsClient
      userId={session.user.id}
      userName={session.user.name || 'Author'}
      locale={validLocale}
      title={t('myNews')}
      description={t('myNewsDescription')}
      blogUsername={username || null}
      siteBaseUrl={getSiteBaseUrl()}
    />
    </>
  )
}
