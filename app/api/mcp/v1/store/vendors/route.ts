import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'
import { queryInt } from '@/app/api/mcp/v1/_lib/query'

export const GET = withMcpGuard(async (request) => {
  await initializeDatabase()
  const db = getDatabaseService()
  const limit = queryInt(request, 'limit', 50) || 50

  const profiles = await db.query({
    collection: 'vendor_profiles',
    pagination: { limit },
    orderBy: [{ field: 'updated_at', direction: 'desc' }],
  })

  const entities = await db.query({
    collection: 'entities',
    filters: [{ field: 'store_activated', operator: '==', value: true }],
    pagination: { limit },
  })

  const items = [
    ...(profiles.success && Array.isArray(profiles.data)
      ? profiles.data.map((row: any) => ({ id: row.id, ...(row.data || row) }))
      : []),
    ...(entities.success && Array.isArray(entities.data)
      ? entities.data.map((row: any) => ({ id: row.id, ...(row.data || row) }))
      : []),
  ]

  return mcpOk({ items, total: items.length })
})
