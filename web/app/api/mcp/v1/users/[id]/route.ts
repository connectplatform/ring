import { db } from '@/lib/database'
import { deleteUser } from '@/features/auth/services/delete-user'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const result = await db().findDocById('users', id)
  if (!result.success || !result.data) return mcpError('User not found', 404)
  return mcpOk(result.data)
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  const update = await db().updateDoc('users', id, { ...body, updatedAt: new Date() })
  if (!update.success) return mcpError(update.error?.message || 'Update failed', 400)
  const result = await db().findDocById('users', id)
  if (!result.success || !result.data) return mcpError('User not found', 404)
  return mcpOk(result.data)
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('Destructive operation requires confirm: true', 400)

  const ok = await deleteUser(id)
  if (!ok) return mcpError('Failed to delete user', 400)
  return mcpOk({ deleted: true, id })
})
