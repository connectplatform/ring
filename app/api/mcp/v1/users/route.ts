import { UserRole } from '@/features/auth/types'
import { createUser } from '@/features/auth/services/create-user'
import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const role = queryString(request, 'role')
  const limit = queryInt(request, 'limit', 50) || 50

  const filters = role
    ? [{ field: 'role', operator: '==' as const, value: role }]
    : []

  const result = await db().queryDocs({
    collection: 'users',
    filters,
    pagination: { limit },
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  })

  if (!result.success) return mcpError(result.error?.message || 'Failed to list users', 500)

  const items = result.data ?? []

  return mcpOk({ items, total: items.length })
})

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (!body?.email || !body?.name) return mcpError('email and name are required', 400)

  const user = await createUser({
    email: String(body.email),
    name: String(body.name),
    role: (body.role as UserRole) || UserRole.subscriber,
  })

  if (!user) return mcpError('Failed to create user', 400)
  return mcpOk(user, 201)
})
