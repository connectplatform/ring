import { getSerializedEntityById } from '@/features/entities/services/get-entity-by-id'
import { updateEntity } from '@/features/entities/services/update-entity'
import { deleteEntity } from '@/features/entities/services/delete-entity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const entity = await getSerializedEntityById(id)
  if (!entity) return mcpError('Entity not found', 404)
  return mcpOk(entity)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const entity = await updateEntity(id, body as any)
  return mcpOk(entity)
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) {
    return mcpError('Destructive operation requires confirm: true in body', 400)
  }
  await deleteEntity(id)
  return mcpOk({ deleted: true, id })
})
