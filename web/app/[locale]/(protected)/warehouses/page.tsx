import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { listMyWarehousesAction } from '@/app/_actions/admin-store-erp'

export default async function MyWarehousesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  const session = await auth()
  if (!session?.user) redirect(ROUTES.LOGIN(locale))
  const t = await getTranslations('modules.admin.storeHub')
  let warehouses: Awaited<ReturnType<typeof listMyWarehousesAction>> = []
  try {
    warehouses = await listMyWarehousesAction()
  } catch {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('warehouses')}</h1>
      {warehouses.length === 0 ? <p className="text-sm text-muted-foreground">{t('noAssignment')}</p> : null}
      <ul className="space-y-2">
        {warehouses.map((row) => (
          <li key={row.id}>
            <Link className="underline" href={ROUTES.WAREHOUSE(row.id, locale)}>
              {row.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
