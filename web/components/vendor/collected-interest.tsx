import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { vendorCartInterest, type ProductCartDemand } from '@/features/store/services/cart-demand'
import { davinciGlassSurface } from '@/lib/ui/davinci'

function DemandList({
  rows,
  empty,
  locale,
  mode,
}: {
  rows: ProductCartDemand[]
  empty: string
  locale: Locale
  mode: 'wanted' | 'fillable' | 'quiet'
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.productId} className="flex items-baseline justify-between gap-3 text-sm">
          <Link
            href={ROUTES.STORE(locale) + '/' + row.productId}
            className="min-w-0 truncate font-medium hover:text-primary"
          >
            {row.name}
          </Link>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {mode === 'wanted'
              ? `${row.carts} · ${row.waitingCarts}`
              : mode === 'fillable'
                ? String(row.waitingCarts)
                : String(row.stock)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** What buyers are already holding, what can ship, and what is stocked with no carts. */
export async function CollectedInterest({
  vendorEntityId,
  locale,
}: {
  vendorEntityId: string
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'vendor.dashboard.interest' })
  const interest = await vendorCartInterest(vendorEntityId)

  return (
    <section className="mb-8 grid gap-4 lg:grid-cols-3">
      <div className={`${davinciGlassSurface} p-4`}>
        <h2 className="mb-1 text-base font-semibold">{t('wantedTitle')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('wantedHint')}</p>
        <DemandList rows={interest.wanted} empty={t('wantedEmpty')} locale={locale} mode="wanted" />
      </div>
      <div className={`${davinciGlassSurface} p-4`}>
        <h2 className="mb-1 text-base font-semibold">{t('fillableTitle')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('fillableHint')}</p>
        <DemandList rows={interest.fillable} empty={t('fillableEmpty')} locale={locale} mode="fillable" />
      </div>
      <div className={`${davinciGlassSurface} p-4`}>
        <h2 className="mb-1 text-base font-semibold">{t('quietTitle')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('quietHint')}</p>
        <DemandList rows={interest.quiet} empty={t('quietEmpty')} locale={locale} mode="quiet" />
      </div>
    </section>
  )
}
