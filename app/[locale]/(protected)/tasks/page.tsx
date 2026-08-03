import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { auth as getAuthSession } from '@/auth'
import type { Session } from 'next-auth'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { ROUTES } from '@/constants/routes'
import { localizedRedirect } from '@/lib/i18n-server-redirect'
import { connection } from 'next/server'
import { TasksTree } from '@/features/tasks/components/tasks-tree'

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
    path: 'tasks',
    pathname: '/tasks',
    robots: { index: false, follow: false },
  })
}

export default async function TasksPage(props: LocalePageProps<Record<string, never>>) {
  await connection()

  const params = await props.params
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  const authSession = (await getAuthSession()) as Session | null
  if (!authSession?.user) {
    localizedRedirect({
      locale: validLocale,
      href: '/login',
      query: {
        callbackUrl: ROUTES.TASKS(validLocale),
      },
    })
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <TasksTree />
    </Suspense>
  )
}
