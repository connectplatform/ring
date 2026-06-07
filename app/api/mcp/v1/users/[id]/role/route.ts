import { UserRole } from '@/features/auth/types'
import { updateUserRole } from '@/features/auth/services/update-user-role'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { readJsonBody } from '@/app/api/mcp/v1/_lib/query'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withMcpGuard(async (request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  const body = await readJsonBody(request)
  if (body?.confirm !== true) return mcpError('set-role requires confirm: true in body', 400)
  if (!body?.role) return mcpError('role is required', 400)

  const ok = await updateUserRole(id, body.role as UserRole)
  if (!ok) return mcpError('Failed to update role', 400)
  return mcpOk({ id, role: body.role })
})
