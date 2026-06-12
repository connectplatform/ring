import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))

  const profile = await db().findDocById('vendor_profiles', id)
  if (profile.success && profile.data) {
    return mcpOk(profile.data)
  }

  const entity = await db().findDocById('entities', id)
  if (entity.success && entity.data) {
    return mcpOk(entity.data)
  }

  return mcpError('Vendor not found', 404)
})
