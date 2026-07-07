import { searchOpportunities } from '@/features/opportunities/services/search-opportunities'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

// Export GET handler with authentication/authorization guard
export const GET = withMcpGuard(async (request) => {
  // Extract 'q' param, fallback to 'query' param for search term
  const query = queryString(request, 'q') || queryString(request, 'query')

  // If neither 'q' nor 'query' exist, return error response
  if (!query)
    return mcpError('Query parameter q or query is required', 400)

  // Prepare search parameters:
  //  - query: user search string
  //  - limit: optional results limit (defaults to 50)
  //  - location: optional location parameter
  const result = await searchOpportunities({
    query,
    limit: queryInt(request, 'limit', 50),
    location: queryString(request, 'location'),
  })

  // Respond with the search results in a standard response envelope
  return mcpOk(result)
})
