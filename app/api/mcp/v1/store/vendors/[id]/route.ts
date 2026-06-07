import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk, mcpError } from '@/app/api/mcp/v1/_lib/respond'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withMcpGuard(async (_request, _actor, context?: Ctx) => {
  const { id } = await (context?.params || Promise.resolve({ id: '' }))
  await initializeDatabase()
  const db = getDatabaseService()

  const profile = await db.findById('vendor_profiles', id)
  if (profile.success && profile.data) {
    const data = (profile.data as any).data || profile.data
    return mcpOk({ id, ...data })
  }

  const entity = await db.findById('entities', id)
  if (entity.success && entity.data) {
    const data = (entity.data as any).data || entity.data
    return mcpOk({ id, ...data })
  }

  return mcpError('Vendor not found', 404)
})
