import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getTranslations } from 'next-intl/server'
import { getVendorEntity } from '@/features/entities/services/vendor-entity'
import VendorDashboardWrapper from '@/components/wrappers/vendor-dashboard-wrapper'
import { connection } from 'next/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMerchantConfigByEntityId } from '@/features/store/lib/merchant-config'
import { resolveReferralCommissionPercent } from '@/features/store/lib/referral-commission'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'vendor.settings' })
  return { title: t('title'), description: t('description') }
}

export default async function VendorSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)

  const session = await auth()
  if (!session?.user?.id) redirect(ROUTES.LOGIN(validLocale))

  const vendorEntity = await getVendorEntity(session.user.id)
  if (!vendorEntity) redirect(ROUTES.VENDOR_START(validLocale))

  const merchantConfig = await getMerchantConfigByEntityId(vendorEntity.id)
  const effectiveReferral = resolveReferralCommissionPercent(undefined, merchantConfig)
  const t = await getTranslations({ locale: validLocale, namespace: 'vendor.settings' })

  return (
    <VendorDashboardWrapper locale={validLocale}>
      <div className="container mx-auto px-6 max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('readOnlyNote')}</p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('storefront')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">{t('storeName')}:</span> {(vendorEntity as { name?: string }).name ?? vendorEntity.id}</p>
            <p><span className="text-muted-foreground">{t('entityId')}:</span> {vendorEntity.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settlement')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {merchantConfig ? (
              <>
                <p>
                  <span className="text-muted-foreground">{t('frequency')}:</span>{' '}
                  {merchantConfig.settlementRules?.frequency ?? t('defaultFrequency')}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('holdPeriod')}:</span>{' '}
                  {merchantConfig.settlementRules?.holdPeriodDays ?? 0} {t('days')}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('platformCommission')}:</span>{' '}
                  {merchantConfig.commissionStructure?.platformCommission ?? '—'}%
                </p>
                <p>
                  <span className="text-muted-foreground">{t('referralCommission')}:</span>{' '}
                  {effectiveReferral.percent}% ({t(`referralSource.${effectiveReferral.source}`)})
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">{t('noMerchantConfig')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </VendorDashboardWrapper>
  )
}
