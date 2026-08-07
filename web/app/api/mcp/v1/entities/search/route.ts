import { searchEntities } from '@/features/entities/services/search-entities'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// Wrap GET handler with guard middleware for authentication/authorization
export const GET = withMcpGuard(async (request) => {
  // Extract 'q' or 'query' parameter from request query string.
  const query = queryString(request, 'q') || queryString(request, 'query')
  // If neither 'q' nor 'query' is provided, return a 400 error response.
  if (!query) return mcpError('Query parameter q or query is required', 400)

  // Call the entity search service with the extracted parameters.
  // - 'query': the user's search string (required)
  // - 'maxResults': optional, defaults to 50 if not provided
  // - 'location': optional, used for location-based filtering
  // Await the search results before responding.
  const result = await searchEntities({
    query,
    maxResults: queryInt(request, 'limit', 50),
    location: queryString(request, 'location'),
  })

  // Return the search results wrapped in a successful MCP API response.
  return mcpOk(result)
  // TODO: Consider applying input validation using Next.js built-in middleware or schema validators.
  // TODO: Replace manual type coercion with Zod or Yup schema validation for better DX and safety.
  // TODO: Investigate using Server Actions if upgrading to the latest Next.js API routes paradigm.
})
