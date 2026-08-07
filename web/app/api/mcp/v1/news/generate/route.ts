import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard' // Provides authorization guard middleware
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond' // Standardized response utilities
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query' // Reads and parses JSON body from requests
import { generateNewsArticle } from '@/features/news/services/article-generator' // Business logic for news generation

/**
 * Defines the shape of the expected request body for generating a news article.
 */
type GenerateNewsBody = {
  source?: 'url' | 'search' | 'text', // Source type for the news article
  value?: string,                     // The value/content for the specified source
  instruction?: string,               // Optional instruction for article generation
  locale?: string,                    // Optional locale for article generation
  enableAudio?: boolean,              // Whether to generate audio as well
  enableImage?: boolean,              // Whether to generate image as well
}

/**
 * POST API endpoint for generating a news article.
 * Uses withMcpGuard to ensure authorized access.
 */
export const POST = withMcpGuard(async (request, actor) => {
  // Parse request body into typed object. Returns undefined fields if not provided.
  const body = await readJsonBody<GenerateNewsBody>(request)
  const source = body?.source
  const value = body?.value?.trim() // Remove leading/trailing spaces from input value

  // Validate required fields 'source' and 'value'
  if (!source || !value) {
    // Return a 400 Bad Request if missing
    return mcpError('source and value are required', 400)
  }

  // Ensure 'source' is one of the valid types
  if (!['url', 'search', 'text'].includes(source)) {
    // Return 400 for invalid source type
    return mcpError('source must be url, search, or text', 400)
  }

  // Call the article-generator service with provided data
  // TODO: If moving to React 19/Next 16 server actions, consider using the new Server Actions API for improved streaming/server logic.
  const result = await generateNewsArticle({
    source,
    value,
    instruction: body.instruction,
    locale: body.locale,
    author: {
      id: actor.id,
      name: actor.name || actor.email || 'MCP Actor', // Fallback to default to prevent undefined
    },
    enableAudio: body.enableAudio,
    enableImage: body.enableImage,
  })

  // If article generation fails, respond with appropriate error and HTTP code
  if (!result.success) {
    return mcpError(result.error || 'Article generation failed', 502)
  }

  // Successful generation, return result and 201 Created
  return mcpOk(result, 201)
})
