import { getOpportunity } from '@/features/opportunities/services/get-opportunity-by-id'
import { OpportunityMatchingService } from '@/features/opportunities/services/matching-service'
import { serializeOpportunityForMatching } from '@/app/api/mcp/v1/_lib/serialize-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

// Type for the context, which optionally contains a params promise with an id
type Ctx = { params: Promise<{ id: string }> }

// POST endpoint, wrapped with MCP guard for authentication/authorization
export const POST = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  // Extract the opportunity id from the params in context.
  // If context is undefined, fallback to a dummy id ('').
  // TODO: Consider direct access to route params if Next.js 16 Route Handlers natively inject them.
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Retrieve the opportunity by id using the service.
  const opportunity = await getOpportunity(id)

  // If not found, return a 404 error response.
  if (!opportunity) return mcpError('Opportunity not found', 404)

  // Instantiate the matching service which will compute opportunity matches.
  const matcher = new OpportunityMatchingService()

  // Prepare the opportunity data for matching.
  // (Possibly normalizes/transforms opportunity for the matcher).
  const serialized = serializeOpportunityForMatching(opportunity)

  // Find matching opportunities by passing the serialized opportunity to the service.
  const result = await matcher.findMatches(serialized)

  // Return the matches in a standard MCP OK response.
  return mcpOk(result)
})
