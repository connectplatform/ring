import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  const limit = queryInt(request, 'limit', 50) || 50

  const profiles = await db().queryDocs({
    collection: 'vendor_profiles',
    pagination: { limit },
    orderBy: [{ field: 'updated_at', direction: 'desc' }],
  })

  const entities = await db().queryDocs({
    collection: 'entities',
    filters: [{ field: 'store_activated', operator: '==', value: true }],
    pagination: { limit },
  })

  const items = [
    ...(profiles.success && profiles.data ? profiles.data : []),
    ...(entities.success && entities.data ? entities.data : []),
  ]

  return mcpOk({ items, total: items.length })
})
