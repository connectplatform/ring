import { z } from 'zod'
import { getSerializedOpportunityById } from '@/features/opportunities/services/get-opportunity-by-id'
import { updateOpportunity } from '@/features/opportunities/services/update-opportunity'
import { deleteOpportunity } from '@/features/opportunities/services/delete-opportunity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Schemas for PATCH (opportunity update) and DELETE (confirmation) bodies.
// PATCH body is Partial<Opportunity> — every field optional; we validate
// structural shape.  `.passthrough()` allows service-layer field validation.
// ---------------------------------------------------------------------------
const patchOpportunitySchema = z.object({}).passthrough()

const deleteOpportunitySchema = z.object({
  confirm: z.literal(true),
}).passthrough()

/** Shared helper: extract { id } from route context. */
async function getId(context?: Ctx): Promise<string> {
  const { id } = await (context?.params ?? Promise.resolve({ id: '' }))
  return id
}

/**
 * GET handler for retrieving an opportunity by ID.
 * Uses withMcpGuard for authentication/authorization.
 * Returns 404 if opportunity not found.
 */
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const id = await getId(context)
  const opportunity = await getSerializedOpportunityById(id)
  if (!opportunity) return mcpError('Opportunity not found', 404)
  return mcpOk(opportunity)
})

/**
 * PATCH handler for updating an opportunity by ID.
 * Reads JSON body and updates the opportunity.
 */
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const id = await getId(context)
  const body = await readJsonBody(request)
  const parsed = patchOpportunitySchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }

  const opportunity = await updateOpportunity(id, parsed.data)
  return mcpOk(opportunity)
})

/**
 * DELETE handler for deleting an opportunity by ID.
 * Requires body.confirm === true for destructive operation.
 */
export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const id = await getId(context)
  const body = await readJsonBody(request)
  const parsed = deleteOpportunitySchema.safeParse(body)

  if (!parsed.success) {
    return mcpError(parsed.error.issues[0]?.message ?? 'Destructive operation requires confirm: true in body', 400)
  }

  await deleteOpportunity(id)
  return mcpOk({ deleted: true, id })
})
