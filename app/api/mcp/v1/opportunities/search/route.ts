import { UserRole } from '@/features/auth/types'
import { searchOpportunities } from '@/features/opportunities/services/search-opportunities'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const query = queryString(request, 'q') || queryString(request, 'query')
  if (!query) return mcpError('Query parameter q or query is required', 400)

  const result = await searchOpportunities({
    query,
    userRole: UserRole.SUPERADMIN,
    limit: queryInt(request, 'limit', 50),
    location: queryString(request, 'location'),
  })

  return mcpOk(result)
})
