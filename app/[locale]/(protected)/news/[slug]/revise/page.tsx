import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import type { NewsArticle } from '@/features/news/types'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { canProposeRevision } from '@/features/news/lib/news-collaboration-permissions'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import MyNewsWrapper from '@/components/wrappers/my-news-wrapper'
import { ReviseNewsClient } from './revise-client'

async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const result = await db().queryDocs({
    collection: 'news',
    filters: [{ field: 'slug', operator: '==', value: slug }],
    pagination: { limit: 1 },
  })
  if (!result.success || !result.data?.length) return null
  return mapNewsDocument(result.data[0])
}

export default async function ReviseNewsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  await connection()
  const { locale: localeParam, slug } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const role = resolveSessionUserRole(session.user.role)
  if (!canProposeRevision(role)) {
    redirect(ROUTES.NEWS(locale))
  }

  const article = await getArticleBySlug(slug)
  if (!article || article.status !== 'published') {
    notFound()
  }
  // Authors use Edit, not Revise.
  if (article.authorId === session.user.id) {
    redirect(ROUTES.MY_NEWS(locale))
  }

  const t = await getTranslations('news')

  return (
    <MyNewsWrapper
      locale={locale}
      title={t('revise.pageTitle')}
      description={article.title}
      userName={session.user.name || t('revise.memberFallback')}
    >
      <ReviseNewsClient
        articleId={article.id}
        articleTitle={article.title}
        initialContent={article.content || ''}
        locale={locale}
        slug={slug}
      />
    </MyNewsWrapper>
  )
}
