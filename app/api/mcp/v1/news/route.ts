import { createNewsArticle, getNewsArticles } from '@/features/news/services/news-service'
import type { NewsCategory, NewsFilters, NewsStatus, NewsVisibility } from '@/features/news/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpFromResult } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

const NEWS_CATEGORIES = new Set<NewsCategory>([
  'platform-updates',
  'partnerships',
  'community',
  'industry-news',
  'events',
  'announcements',
  'security',
  'press-releases',
  'tutorials',
  'other',
  'blogs',
])

function queryNewsCategory(request: Parameters<typeof queryString>[0]): NewsCategory | undefined {
  const raw = queryString(request, 'category')
  if (!raw) return undefined
  return NEWS_CATEGORIES.has(raw as NewsCategory) ? (raw as NewsCategory) : undefined
}

function buildNewsFilters(request: Parameters<typeof queryString>[0]): NewsFilters {
  const filters: NewsFilters = {
    limit: queryInt(request, 'limit', 50),
    search: queryString(request, 'search'),
    authorId: queryString(request, 'authorId'),
  }

  const category = queryNewsCategory(request)
  if (category) filters.category = category

  const status = queryString(request, 'status')
  if (status === 'draft' || status === 'published' || status === 'archived') {
    filters.status = status as NewsStatus
  }

  const visibility = queryString(request, 'visibility')
  if (
    visibility === 'public' ||
    visibility === 'subscriber' ||
    visibility === 'member' ||
    visibility === 'confidential' ||
    visibility === 'blog-only' ||
    visibility === 'site-wide'
  ) {
    filters.visibility = visibility as NewsVisibility
  }

  return filters
}

export const GET = withMcpGuard(async (request) => {
  const result = await getNewsArticles(buildNewsFilters(request))
  return mcpFromResult(result)
})

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const payload = {
    ...body,
    status: body.status || 'draft',
  }
  const result = await createNewsArticle(payload as any)
  return mcpFromResult(result, result.success ? 201 : 400)
})
