import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { ArticleEditor } from '@/features/news/components/article-editor'
import { canCreateNewsArticle } from '@/features/news/lib/news-permissions'
import MyNewsWrapper from '@/components/wrappers/my-news-wrapper'
import { ROUTES } from '@/constants/routes'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { getSiteBaseUrl } from '@/lib/ring-config-core'

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
    title: t('createArticle'),
    description: t('myNewsDescription'),
    robots: { index: false, follow: false },
  }
}

/**
 * Member-facing article create — reuses ArticleEditor without AdminWrapper rail.
 * Admins may also use this route; platform create remains at /admin/news/create.
 */
export default async function MemberNewsCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await connection()

  const { locale } = await params
  const validLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : (routing.defaultLocale as Locale)
  setRequestLocale(validLocale)

  const session = await auth()
  if (!session?.user) {
    redirect(
      `${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.NEWS_CREATE(validLocale))}`,
    )
  }

  if (!canCreateNewsArticle(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale))
  }

  const t = await getTranslations('news')
  let username =
    typeof session.user.username === 'string' ? session.user.username.trim() : ''
  if (!username) {
    try {
      const { getUserById } = await import('@/features/auth/services/get-user-by-id')
      const profile = await getUserById(session.user.id)
      const fromDb =
        typeof profile?.username === 'string' ? profile.username.trim() : ''
      username = fromDb.replace(/^@/, '')
    } catch {
      // keep empty — rail shows set-username CTA
    }
  } else {
    username = username.replace(/^@/, '')
  }

  return (
    <MyNewsWrapper
      locale={validLocale}
      title={t('createArticle')}
      description={t('myNewsDescription')}
      userName={session.user.name || 'Author'}
      blogUsername={username || null}
      siteBaseUrl={getSiteBaseUrl()}
    >
      <ArticleEditor
        mode="create"
        locale={validLocale}
        backHref={ROUTES.MY_NEWS(validLocale)}
        audience="member"
      />
    </MyNewsWrapper>
  )
}
