import { assertKnownUserRole } from '@/features/auth/user-role'
import { getOpportunitiesForRole } from '@/features/opportunities/services/get-opportunities'
import { createOpportunity } from '@/features/opportunities/services/create-opportunity'
import { createOpportunityBodySchema } from '@/features/opportunities/lib/create-opportunity-schema'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

// Handles GET requests to fetch opportunities according to the requesting user's role and query params.
export const GET = withMcpGuard(async (request, actor) => {
  // Validate the user role; throws if the role is not recognized
  const userRole = assertKnownUserRole(actor.role)

  // Parse query parameters for pagination and search
  const limit = queryInt(request, 'limit', 20)
  const startAfter = queryString(request, 'startAfter')
  const query = queryString(request, 'search')

  // Fetch the list of opportunities available to the given role and query
  const result = await getOpportunitiesForRole({
    userRole,
    limit,
    startAfter,
    query,
  })

  return mcpOk(result)
})

// Handles POST requests to create a new opportunity from the request body.
export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  const parsed = createOpportunityBodySchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  // Cast is safe — Zod verified required fields; service handles deeper validation
  const opportunity = await createOpportunity(parsed.data as Parameters<typeof createOpportunity>[0])
  return mcpOk(opportunity, 201)
})
