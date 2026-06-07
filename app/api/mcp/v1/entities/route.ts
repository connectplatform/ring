import { UserRole } from '@/features/auth/types'
import { getEntitiesForRole } from '@/features/entities/services/get-entities'
import { createEntity } from '@/features/entities/services/create-entity'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt, queryString, readJsonBody } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const limit = queryInt(request, 'limit', 20)
  const startAfter = queryString(request, 'startAfter')
  const search = queryString(request, 'search')

  const result = await getEntitiesForRole({
    userRole: UserRole.SUPERADMIN,
    limit,
    startAfter,
    filters: search ? { search } : undefined,
  })

  return mcpOk(result)
})

export const POST = withMcpGuard(async (request) => {
  const body = await readJsonBody(request)
  if (!body || typeof body !== 'object') {
    return mcpError('Request body required', 400)
  }

  const entity = await createEntity(body as any)
  return mcpOk(entity, 201)
})
