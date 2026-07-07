import { z } from 'zod'
import { createNewsArticle, getNewsArticles } from '@/features/news/services/news-service'
import type { NewsCategory, NewsFilters, NewsStatus, NewsVisibility } from '@/features/news/types'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpFromResult, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// ---------------------------------------------------------------------------
// Create-news-article schema — validates the body at the route layer.
//
// Required by NewsFormData (no service default):
//   title, content, excerpt, category, tags, visibility, featured
//
// Has default: status (→'draft', preserved from original code)
// ---------------------------------------------------------------------------
const createNewsArticleSchema = z.object({
  // Required — NewsFormData has no defaults for these
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  excerpt: z.string().min(1, 'excerpt is required'),
  category: z.string().min(1, 'category is required'),
  tags: z.array(z.string()),
  visibility: z.enum(['public', 'subscriber', 'member', 'confidential', 'blog-only', 'site-wide']),
  featured: z.boolean(),

  // Has default — preserves original `status: body.status || 'draft'` behavior
  status: z.enum(['draft', 'published', 'archived']).default('draft'),

  // Optional fields from NewsFormData
  slug: z.string().optional(),
  featuredImage: z.string().optional(),
  audioUrl: z.string().optional(),
  gallery: z.array(z.string()).optional(),
}).passthrough()

// Set of all valid news categories for runtime checking
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

/**
 * Extracts and validates the 'category' query parameter from the request.
 * Only allows valid categories defined in NEWS_CATEGORIES.
 * @param request - The request object
 * @returns NewsCategory | undefined
 */
function queryNewsCategory(request: Parameters<typeof queryString>[0]): NewsCategory | undefined {
  const raw = queryString(request, 'category') // read the 'category' param from query
  if (!raw) return undefined // return undefined if not supplied
  // If a valid category, cast and return, otherwise undefined
  return NEWS_CATEGORIES.has(raw as NewsCategory) ? (raw as NewsCategory) : undefined
}

/**
 * Aggregates and validates all filters from the incoming query params.
 * Builds a NewsFilters object including limit, search, authorId,
 * category, status, and visibility (validates enum values).
 * @param request - The request object
 * @returns NewsFilters
 */
function buildNewsFilters(request: Parameters<typeof queryString>[0]): NewsFilters {
  // Initialize filters with base parameters, using defaults if undefined
  const filters: NewsFilters = {
    limit: queryInt(request, 'limit', 50),         // Default limit is 50
    search: queryString(request, 'search'),        // Optional search string
    authorId: queryString(request, 'authorId'),    // Optional author ID
  }

  // Add 'category' to filters if valid category is found
  const category = queryNewsCategory(request)
  if (category) filters.category = category

  // Validate and add 'status' to filters if it's one of allowed values
  const status = queryString(request, 'status')
  if (status === 'draft' || status === 'published' || status === 'archived') {
    filters.status = status as NewsStatus
  }

  // Validate and add 'visibility' to filters if valid
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

/**
 * GET handler: Returns a filtered list of news articles.
 * Applies all query filters then passes to the service for fetching.
 * Returned result is formatted with mcpFromResult helper.
 */
export const GET = withMcpGuard(async (request) => {
  // TODO: When React 19/Next 16 fully supports async/await in server actions,
  // consider using server actions pattern here for improved interop.
  const result = await getNewsArticles(buildNewsFilters(request))
  return mcpFromResult(result)
})

/**
 * POST handler: Creates a new news article from the provided JSON body.
 * Validates the body with Zod, ensures default status is 'draft' if missing.
 * Returns 201 on success, 400 otherwise.
 */
export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const parsed = createNewsArticleSchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  // Cast is safe — Zod verified title + content; service validates full NewsFormData
  const result = await createNewsArticle(parsed.data as Parameters<typeof createNewsArticle>[0])

  // Invalidate news-stats cache + revalidate admin paths
  if (result.success) {
    const { syncNewsDiscovery } = await import('@/features/news/lib/news-mutation-sync')
    await syncNewsDiscovery({
      articleId: result.data?.id,
      event: 'created',
    })
  }

  return mcpFromResult(result, result.success ? 201 : 400)
})
