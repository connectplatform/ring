import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

export async function checkDuplicateNews(params: {
  title: string
  slug: string
  siteWideSlug?: string
  excludeId?: string
}): Promise<{ duplicateRisk: number; matchedId?: string }> {
  await initializeDatabase()
  const db = getDatabaseService()
  const titleNorm = params.title.trim().toLowerCase()

  for (const field of ['slug', 'siteWideSlug'] as const) {
    const value = field === 'slug' ? params.slug : params.siteWideSlug
    if (!value) continue
    const result = await db.query({
      collection: 'news',
      filters: [{ field, operator: '==', value }],
      pagination: { limit: 5 },
    })
    if (!result.success) continue
    for (const row of result.data) {
      if (params.excludeId && row.id === params.excludeId) continue
      return { duplicateRisk: 0.95, matchedId: row.id }
    }
  }

  const list = await db.query({
    collection: 'news',
    filters: [{ field: 'status', operator: '==', value: 'published' }],
    pagination: { limit: 200 },
  })
  if (!list.success) return { duplicateRisk: 0 }

  for (const row of list.data) {
    if (params.excludeId && row.id === params.excludeId) continue
    const d = (row.data ?? row) as Record<string, unknown>
    const t = String(d.title ?? '').trim().toLowerCase()
    if (t && t === titleNorm) return { duplicateRisk: 0.9, matchedId: row.id }
  }

  return { duplicateRisk: 0 }
}
