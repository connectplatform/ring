import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { MyOrdersListClient } from '@/features/crm/orders/my-orders-list-client'

export default async function MyOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const sp = await searchParams
  const filterRaw = sp.filter
  const currentFilter =
    filterRaw === 'active' || filterRaw === 'completed' || filterRaw === 'paid'
      ? filterRaw
      : 'all'

  const orders = await ProjectOrderService.listForUser(session.user.id)
  const userIds = orders
    .map((o) => o.integratorId)
    .filter(Boolean) as string[]
  const users = await resolveCrmUserChips(userIds)
  const t = await getTranslations('calculator')

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {t('order.buyerBadge')}
        </p>
        <h1 className="text-2xl font-bold">{t('order.buyerTitle')}</h1>
        <p className="text-muted-foreground">{t('order.buyerSubtitle')}</p>
      </div>
      <Suspense fallback={null}>
        <MyOrdersListClient
          currentFilter={currentFilter}
          locale={locale}
          orders={orders}
          users={users}
        />
      </Suspense>
    </div>
  )
}
