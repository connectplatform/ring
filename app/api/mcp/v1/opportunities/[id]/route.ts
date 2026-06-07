import { getSerializedOpportunityById } from '@/features/opportunities/services/get-opportunity-by-id'
import { updateOpportunity } from '@/features/opportunities/services/update-opportunity'
import { deleteOpportunity } from '@/features/opportunities/services/delete-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const opportunity = await getSerializedOpportunityById(id)
  if (!opportunity) return mcpError('Opportunity not found', 404)
  return mcpOk(opportunity)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const opportunity = await updateOpportunity(id, body as any)
  return mcpOk(opportunity)
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) {
    return mcpError('Destructive operation requires confirm: true in body', 400)
  }
  await deleteOpportunity(id)
  return mcpOk({ deleted: true, id })
})
