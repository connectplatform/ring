import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { db } from '@/lib/database'
import { mapNewsDocument } from '@/lib/news/map-news-document'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import {
  getRevisionById,
  listRevisionsForArticle,
} from '@/features/news/services/revision-service'
import { canResolveRevision } from '@/features/news/lib/news-collaboration-permissions'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import MyNewsWrapper from '@/components/wrappers/my-news-wrapper'
import { AmendmentsClient } from '../amendments-client'

export default async function AmendmentPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; articleId: string; revisionId: string }>
}) {
  await connection()
  const { locale: localeParam, articleId, revisionId } = await params
  const locale: Locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTES.LOGIN(locale))
  }

  const articleResult = await db().findDocById('news', articleId)
  if (!articleResult.success || !articleResult.data) {
    notFound()
  }
  const article = mapNewsDocument(articleResult.data)
  const role = resolveSessionUserRole(session.user.role)
  const canResolve = canResolveRevision(role, article.authorId, session.user.id)
  if (!canResolve) {
    redirect(ROUTES.MY_NEWS(locale))
  }

  const [selectedResult, listResult] = await Promise.all([
    getRevisionById(revisionId),
    listRevisionsForArticle(articleId, 'pending-revision'),
  ])
  if (!selectedResult.success || !selectedResult.data) {
    notFound()
  }
  if (selectedResult.data.articleId !== articleId) {
    notFound()
  }

  const t = await getTranslations('news')

  return (
    <MyNewsWrapper
      locale={locale}
      title={t('amendments.previewTitle')}
      description={article.title}
      userName={session.user.name || t('revise.memberFallback')}
    >
      <AmendmentsClient
        locale={locale}
        articleId={articleId}
        articleTitle={article.title}
        revisions={listResult.data || [selectedResult.data]}
        selected={selectedResult.data}
        canResolve={canResolve}
      />
    </MyNewsWrapper>
  )
}
