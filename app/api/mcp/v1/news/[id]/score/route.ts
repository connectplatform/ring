import { runAiScoringForArticle } from '@/features/news/services/news-promotion-workflow'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

// Context type: carries a `params` property which is a promise resolving to an object with the article ID.
type Ctx = { params: Promise<{ id: string }> }

// API route handler for POST requests, wrapped in authorization guard
export const POST = withMcpGuard(
  async (_request, _actor, context?: Ctx) => {
    // Await the params property from the context to extract the article ID.
    // If params is missing, fall back to an empty ID string.
    // TODO: In Next.js 13/14/16 with file-based routing, consider refactoring to leverage the new Route Handlers' parameter extraction for cleaner parameter passing.
    const { id } = await (context?.params || Promise.resolve({ id: '' }))

    // Call the AI scoring service for the given article ID and await its result.
    // TODO: Handle possible errors from runAiScoringForArticle and return appropriate error responses.
    const result = await runAiScoringForArticle(id)

    // Return the successful AI scoring response using the response helper.
    return mcpOk(result)
  }
)
