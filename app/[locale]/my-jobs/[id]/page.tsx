import { connection } from 'next/server'
import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import {
  hasMemberPrivileges,
  isPlatformAdmin,
  parseUserRolesArray,
} from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ProjectOrderService } from '@/features/crm/orders/project-order-service'
import { resolveCrmUserChips } from '@/features/crm/orders/resolve-users'
import { OrderLabShell } from '@/features/crm/lab/order-lab-shell'

export default async function MyJobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }
  const role = parseUserRolesArray(session.user.role)
  const admin = isPlatformAdmin(session.user.role)
  if (!admin && (!role || !hasMemberPrivileges(role))) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const order = await ProjectOrderService.getById(id)
  if (!order) notFound()
  if (!admin && order.integratorId !== session.user.id) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  const users = await resolveCrmUserChips([order.userId])
  const buyer = users[order.userId] ?? null

  return <OrderLabShell buyer={buyer} locale={locale} order={order} />
}
