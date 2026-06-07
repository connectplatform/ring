import { UserRole } from '@/features/auth/types'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { createOpportunity } from '@/features/opportunities/services/create-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const result = await getOpportunitiesForRole({
    userRole: UserRole.SUPERADMIN,
    limit: queryInt(request, 'limit', 20),
    startAfter: queryString(request, 'startAfter'),
    query: queryString(request, 'search'),
  })
  return mcpOk(result)
})

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') return mcpError('Request body required', 400)
  const opportunity = await createOpportunity(body as any)
  return mcpOk(opportunity, 201)
})
