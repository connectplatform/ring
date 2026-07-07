import { getSerializedEntityById } from '@/features/entities/services/get-entity-by-id'
import { updateEntity } from '@/features/entities/services/update-entity'
import { deleteEntity } from '@/features/entities/services/delete-entity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> } // Context type, contains route params asynchronously

// GET handler for fetching a serialized entity by ID
export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  // Extract 'id' from context params, fallback to empty id if not present
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Retrieve entity using the given 'id'
  const entity = await getSerializedEntityById(id)

  // If entity does not exist, return error response with 404 status
  if (!entity) return mcpError('Entity not found', 404)

  // Return successful response with entity data
  return mcpOk(entity)
  // TODO: Consider input validation on 'id' for more robust error handling (Next16 allows Zod/Schemas at edge)
})

// PATCH handler for updating an entity by ID
export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  // Extract 'id' from context params
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Parse JSON body from the incoming request
  const body = await readJsonBody(request)

  // Update the entity by provided 'id' and request body
  // TODO: Validate 'body' before updating (React 19/Next 16 recommend strong input types/validation)
  const entity = await updateEntity(id, body as any)

  // Return entity after successful update
  return mcpOk(entity)
})

// DELETE handler for deleting an entity by ID
export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  // Extract 'id' from context params
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  // Parse JSON body from request
  const body = await readJsonBody(request)

  // Ensure destructive operation is confirmed in request body
  if (body?.confirm !== true) {
    // If confirm flag not true, return a 400 error response
    return mcpError('Destructive operation requires confirm: true in body', 400)
  }

  // Delete the entity by ID
  await deleteEntity(id)

  // Return success response indicating deletion
  return mcpOk({ deleted: true, id })
  // TODO: Optionally consider optimistic updates or return deleted entity payload (React 19 APIs prefer rich responses)
})
