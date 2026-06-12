import { db } from '@/lib/database'
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
  const result = await db().queryDocs({
    collection: 'news',
    pagination: { limit: 500 },
  })

  const categories = new Set<string>(DEFAULT_CATEGORIES)
  if (result.success && result.data) {
    for (const row of result.data) {
      if (row?.category) categories.add(String(row.category))
    }
  }

  return mcpOk({ categories: [...categories].sort() })
})
