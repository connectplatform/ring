import { initializeDatabase, getDatabaseService } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

const DEFAULT_CATEGORIES = [
  'announcements',
  'product',
  'engineering',
  'community',
  'other',
]

export const GET = withMcpGuard(async () => {
  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.query({
    collection: 'news',
    pagination: { limit: 500 },
  })

  const categories = new Set<string>(DEFAULT_CATEGORIES)
  if (result.success && Array.isArray(result.data)) {
    for (const row of result.data as any[]) {
      const data = row.data || row
      if (data?.category) categories.add(String(data.category))
    }
  }

  return mcpOk({ categories: [...categories].sort() })
})
