import { db } from '@/lib/database'
import { withMcpGuard } from '@/app/api/mcp/v1/_lib/guard'
import { mcpOk } from '@/app/api/mcp/v1/_lib/respond'

// Define the default news categories statically.
// These act as a baseline for the response.
const DEFAULT_CATEGORIES = [
  'announcements',
  'product',
  'engineering',
  'community',
  'other',
]

// Guard the GET handler with an MCP access check.
// The GET endpoint fetches all news categories, both default and dynamic.
export const GET = withMcpGuard(async () => {
  // Query up to 500 news documents from the 'news' collection.
  // TODO: Consider adding server-side pagination using Next.js 16 native streaming APIs for large collections.
  const result = await db().queryDocs({
    collection: 'news',
    pagination: { limit: 500 },
  })

  // Start with all default categories.
  const categories = new Set<string>(DEFAULT_CATEGORIES)

  // If query succeeds and data is present,
  // iterate all records and add their 'category' field to the set.
  // This ensures categories are unique, combining static and dynamic.
  if (result.success && result.data) {
    for (const row of result.data) {
      // Add news item's category if it exists.
      if (row?.category) categories.add(String(row.category))
    }
  }

  // Respond with an MCP OK, categories sorted alphabetically.
  // TODO: Revisit response shape if considering localization/internationalization.
  return mcpOk({ categories: [...categories].sort() })
})
