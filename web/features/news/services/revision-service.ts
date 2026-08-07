/**
 * News revision service — pending-revision side channel for published articles.
 */

import { auth } from '@/auth'
import { db } from '@/lib/database'
import type { DbRow } from '@/lib/database'
import { logger } from '@/lib/logger'
import { resolveSessionUserRole } from '@/features/auth/user-role'
import {
  canProposeRevision,
  canResolveRevision,
  canViewRevision,
} from '@/features/news/lib/news-collaboration-permissions'
import {
  buildDiffLines,
  contentToDiffText,
  summarizeDiff,
} from '@/features/news/lib/revision-diff'
import type { NewsRevision, NewsRevisionStatus } from '@/features/news/types/collaboration'
import { mapNewsDocument } from '@/lib/news/map-news-document'

const COLLECTION = 'news_revisions'

type RevisionData = {
  article_id: string
  article_title?: string
  article_slug?: string
  base_content: string
  proposed_content: string
  proposed_json?: Record<string, unknown>
  status: NewsRevisionStatus
  proposer_id: string
  proposer_name: string
  diff_summary?: { added: number; removed: number }
  resolved_at?: string
  resolved_by?: string
}

type RevisionRow = DbRow<RevisionData & Record<string, unknown>>

function rowToRevision(row: RevisionRow): NewsRevision {
  return {
    id: row.id,
    articleId: String(row.article_id),
    articleTitle: row.article_title ? String(row.article_title) : undefined,
    articleSlug: row.article_slug ? String(row.article_slug) : undefined,
    baseContent: String(row.base_content ?? ''),
    proposedContent: String(row.proposed_content ?? ''),
    proposedJson: row.proposed_json as Record<string, unknown> | undefined,
    status: row.status as NewsRevisionStatus,
    proposerId: String(row.proposer_id),
    proposerName: String(row.proposer_name ?? 'Member'),
    diffSummary: row.diff_summary as NewsRevision['diffSummary'],
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt ?? new Date().toISOString()),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt ?? new Date().toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
  }
}

export async function createPendingRevision(input: {
  articleId: string
  proposedContent: string
  proposedJson?: Record<string, unknown>
}): Promise<{ success: boolean; data?: NewsRevision; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }
    const role = resolveSessionUserRole(session.user.role)
    if (!canProposeRevision(role)) {
      return { success: false, error: 'Forbidden' }
    }

    const articleResult = await db().findDocById('news', input.articleId)
    if (!articleResult.success || !articleResult.data) {
      return { success: false, error: 'Article not found' }
    }
    const article = mapNewsDocument(articleResult.data)
    if (article.status !== 'published') {
      return { success: false, error: 'Only published articles accept revisions' }
    }
    // Authors edit live articles; revisions are for other members.
    if (article.authorId === session.user.id) {
      return { success: false, error: 'Authors should edit the article directly' }
    }

    const proposed = input.proposedContent.trim()
    if (!proposed) {
      return { success: false, error: 'proposedContent required' }
    }

    const baseContent = article.content || ''
    if (contentToDiffText(baseContent) === contentToDiffText(proposed)) {
      return { success: false, error: 'No changes detected versus published article' }
    }

    const lines = buildDiffLines(contentToDiffText(baseContent), contentToDiffText(proposed))
    const diffSummary = summarizeDiff(lines)

    const payload: RevisionData = {
      article_id: input.articleId,
      article_title: article.title,
      article_slug: article.slug,
      base_content: baseContent,
      proposed_content: proposed,
      proposed_json: input.proposedJson,
      status: 'pending-revision',
      proposer_id: session.user.id,
      proposer_name: session.user.name || session.user.email || 'Member',
      diff_summary: diffSummary,
    }

    const createResult = await db().createDoc(COLLECTION, payload)
    if (!createResult.success || !createResult.data) {
      throw createResult.error || new Error('Failed to create revision')
    }

    return { success: true, data: rowToRevision(createResult.data as RevisionRow) }
  } catch (error) {
    logger.error('createPendingRevision failed', error)
    return { success: false, error: 'Failed to create revision' }
  }
}

export async function listRevisionsForArticle(
  articleId: string,
  status?: NewsRevisionStatus,
): Promise<{ success: boolean; data?: NewsRevision[]; error?: string }> {
  try {
    const filters: Array<{ field: string; operator: '=='; value: string }> = [
      { field: 'article_id', operator: '==', value: articleId },
    ]
    if (status) {
      filters.push({ field: 'status', operator: '==', value: status })
    }
    const result = await db().queryDocs({
      collection: COLLECTION,
      filters,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 },
    })
    if (!result.success) {
      const message =
        result.error instanceof Error ? result.error.message : 'Query failed'
      return { success: false, error: message }
    }
    const rows = (result.data || []) as RevisionRow[]
    return { success: true, data: rows.map(rowToRevision) }
  } catch (error) {
    logger.error('listRevisionsForArticle failed', error)
    return { success: false, error: 'Failed to list revisions' }
  }
}

/**
 * Authenticated list — authors/admins see all; others only their own proposals.
 */
export async function listRevisionsForViewer(
  articleId: string,
  status?: NewsRevisionStatus,
): Promise<{ success: boolean; data?: NewsRevision[]; error?: string; httpStatus?: number }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', httpStatus: 401 }
  }

  const articleResult = await db().findDocById('news', articleId)
  if (!articleResult.success || !articleResult.data) {
    return { success: false, error: 'Article not found', httpStatus: 404 }
  }
  const article = mapNewsDocument(articleResult.data)
  const role = resolveSessionUserRole(session.user.role)

  const listed = await listRevisionsForArticle(articleId, status)
  if (!listed.success || !listed.data) {
    return { success: false, error: listed.error || 'Query failed', httpStatus: 500 }
  }

  if (canResolveRevision(role, article.authorId, session.user.id)) {
    return { success: true, data: listed.data }
  }

  const own = listed.data.filter((r) => r.proposerId === session.user!.id)
  return { success: true, data: own }
}

/**
 * Authenticated get — author/admin or the proposer.
 */
export async function getRevisionForViewer(
  revisionId: string,
): Promise<{ success: boolean; data?: NewsRevision; error?: string; httpStatus?: number }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', httpStatus: 401 }
  }

  const revResult = await getRevisionById(revisionId)
  if (!revResult.success || !revResult.data) {
    return { success: false, error: revResult.error || 'Not found', httpStatus: 404 }
  }

  const articleResult = await db().findDocById('news', revResult.data.articleId)
  if (!articleResult.success || !articleResult.data) {
    return { success: false, error: 'Article not found', httpStatus: 404 }
  }
  const article = mapNewsDocument(articleResult.data)
  const role = resolveSessionUserRole(session.user.role)

  if (
    !canViewRevision(
      role,
      article.authorId,
      session.user.id,
      revResult.data.proposerId,
    )
  ) {
    return { success: false, error: 'Forbidden', httpStatus: 403 }
  }

  return { success: true, data: revResult.data }
}

export async function countPendingRevisionsByArticleIds(
  articleIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  if (!articleIds.length) return counts
  await Promise.all(
    articleIds.map(async (id) => {
      const result = await listRevisionsForArticle(id, 'pending-revision')
      counts[id] = result.data?.length ?? 0
    }),
  )
  return counts
}

export async function getRevisionById(
  revisionId: string,
): Promise<{ success: boolean; data?: NewsRevision; error?: string }> {
  try {
    const result = await db().findDocById(COLLECTION, revisionId)
    if (!result.success || !result.data) {
      return { success: false, error: 'Revision not found' }
    }
    return { success: true, data: rowToRevision(result.data as RevisionRow) }
  } catch (error) {
    logger.error('getRevisionById failed', error)
    return { success: false, error: 'Failed to load revision' }
  }
}

export async function resolveRevision(
  revisionId: string,
  action: 'accept' | 'reject',
): Promise<{ success: boolean; data?: NewsRevision; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const revResult = await getRevisionById(revisionId)
    if (!revResult.success || !revResult.data) {
      return { success: false, error: revResult.error || 'Not found' }
    }
    const revision = revResult.data
    if (revision.status !== 'pending-revision') {
      return { success: false, error: 'Revision is not pending' }
    }

    const articleResult = await db().findDocById('news', revision.articleId)
    if (!articleResult.success || !articleResult.data) {
      return { success: false, error: 'Article not found' }
    }
    const article = mapNewsDocument(articleResult.data)
    const role = resolveSessionUserRole(session.user.role)
    if (!canResolveRevision(role, article.authorId, session.user.id)) {
      return { success: false, error: 'Forbidden' }
    }

    if (action === 'accept') {
      const {
        appendCommit,
        fromEmbeddedVersions,
        toEmbeddedVersions,
      } = await import('@/lib/versioning')
      const { doc: nextVersionDoc } = appendCommit(
        fromEmbeddedVersions(
          'news_article',
          revision.articleId,
          article.versions ?? null,
        ),
        {
          entityType: 'news_article',
          entityId: revision.articleId,
          createdBy: session.user.id,
          content: revision.proposedContent,
          contentFormat: 'markdown',
          label: 'Accept revision',
        },
      )
      const updateArticle = await db().updateDoc('news', revision.articleId, {
        content: revision.proposedContent,
        versions: toEmbeddedVersions(nextVersionDoc),
        updatedAt: new Date(),
      })
      if (!updateArticle.success) {
        return { success: false, error: 'Failed to apply revision to article' }
      }
    }

    const now = new Date().toISOString()
    const updateRev = await db().updateDoc(COLLECTION, revisionId, {
      status: action === 'accept' ? 'accepted' : 'rejected',
      resolved_at: now,
      resolved_by: session.user.id,
      updatedAt: new Date(),
    })
    if (!updateRev.success) {
      return { success: false, error: 'Failed to update revision status' }
    }

    // Re-fetch full row — updateDoc may return a partial merge snapshot.
    const refreshed = await getRevisionById(revisionId)
    if (!refreshed.success || !refreshed.data) {
      return {
        success: true,
        data: {
          ...revision,
          status: action === 'accept' ? 'accepted' : 'rejected',
          resolvedAt: now,
          resolvedBy: session.user.id,
        },
      }
    }
    return { success: true, data: refreshed.data }
  } catch (error) {
    logger.error('resolveRevision failed', error)
    return { success: false, error: 'Failed to resolve revision' }
  }
}
