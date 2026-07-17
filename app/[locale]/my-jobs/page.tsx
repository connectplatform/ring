import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { hasMemberPrivileges, parseUserRolesArray } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { MyJobsListClient } from '@/features/crm/orders/my-jobs-list-client'

type DeskFilter = 'all' | 'active' | 'completed' | 'disputed'

function parseFilter(raw: string | undefined): DeskFilter {
  if (raw === 'active' || raw === 'completed' || raw === 'disputed') return raw
  return 'all'
}

export default async function MyJobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ workStatus?: string }>
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
  const role = parseUserRolesArray(session.user.role)
  if (!role || !hasMemberPrivileges(role)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const { workStatus } = await searchParams
  const currentFilter = parseFilter(workStatus)

  const jobs = await ProjectOrderService.listForIntegrator(session.user.id)
  const users = await resolveCrmUserChips(jobs.map((j) => j.userId))
  const t = await getTranslations('calculator')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('order.deskBadge')}
        </p>
        <h1 className="text-2xl font-bold">{t('order.deskTitle')}</h1>
        <p className="text-muted-foreground">{t('order.deskSubtitle')}</p>
      </div>

      <MyJobsListClient
        currentFilter={currentFilter}
        locale={locale}
        orders={jobs}
        users={users}
      />
    </div>
  )
}
