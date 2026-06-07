import { getOpportunity } from '@/features/opportunities/services/get-opportunity-by-id'
import { OpportunityMatchingService } from '@/features/opportunities/services/matching-service'
import { serializeOpportunityForMatching } from '@/app/api/mcp/v1/_lib/serialize-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const opportunity = await getOpportunity(id)
  if (!opportunity) return mcpError('Opportunity not found', 404)

  const matcher = new OpportunityMatchingService()
  const result = await matcher.findMatches(serializeOpportunityForMatching(opportunity))
  return mcpOk(result)
})
