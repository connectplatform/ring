import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { deleteUser } from '@/features/auth/services/delete-user'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.findById('users', id)
  if (!result.success || !result.data) return mcpError('User not found', 404)
  const data = (result.data as any).data || result.data
  return mcpOk({ id, ...data })
})

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  await initializeDatabase()
  const db = getDatabaseService()
  const update = await db.update('users', id, { ...body, updatedAt: new Date() })
  if (!update.success) return mcpError(update.error?.message || 'Update failed', 400)
  const result = await db.findById('users', id)
  const data = (result.data as any)?.data || result.data
  return mcpOk({ id, ...data })
})

export const DELETE = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('Destructive operation requires confirm: true', 400)

  const ok = await deleteUser(id)
  if (!ok) return mcpError('Failed to delete user', 400)
  return mcpOk({ deleted: true, id })
})
