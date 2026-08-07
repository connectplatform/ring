/**
 * Member (or admin) article edit — counterpart to NEWS_EDIT route.
 * Admin-only chrome lives under /admin/news/edit/[id].
 */

import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import type { NewsArticle } from '@/features/news/types'
import { ArticleEditor } from '@/features/news/components/article-editor'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { canEditNewsArticle } from '@/features/news/lib/news-permissions'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import MyNewsWrapper from '@/components/wrappers/my-news-wrapper'

async function getArticle(id: string): Promise<NewsArticle | null> {
  const result = await db().findDocById('news', id)
  if (!result.success || !result.data) return null
  return mapNewsDocument(result.data)
}

export default async function MemberNewsEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  await connection()
  const { locale: localeParam, id } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(
      `${ROUTES.LOGIN(locale)}?callbackUrl=${encodeURIComponent(ROUTES.NEWS_EDIT(id, locale))}`,
    )
  }

  const article = await getArticle(id)
  if (!article) notFound()

  const role = resolveSessionUserRole(session.user.role)
  if (!canEditNewsArticle(role, article.authorId, session.user.id)) {
    redirect(ROUTES.UNAUTHORIZED(locale))
  }

  return (
    <MyNewsWrapper
      locale={locale}
      title="Edit article"
      description={article.title}
      userName={session.user.name || 'Author'}
    >
      <div className="container mx-auto px-4 py-4">
        <ArticleEditor
          mode="edit"
          article={article}
          locale={locale}
          audience="member"
          backHref={ROUTES.MY_NEWS(locale)}
        />
      </div>
    </MyNewsWrapper>
  )
}
