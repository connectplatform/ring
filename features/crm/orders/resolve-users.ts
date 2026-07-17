import 'server-only'

import { db, initializeDatabase } from '@/lib/database'

export type CrmUserChip = {
  id: string
  name: string
  email?: string | null
  photoURL?: string | null
}

export async function resolveCrmUserChips(ids: string[]): Promise<Record<string, CrmUserChip>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}

  await initializeDatabase()
  const result = await db().queryDocs({
    collection: 'users',
    filters: [{ field: 'id', operator: 'in', value: unique }],
    pagination: { limit: unique.length },
  })

  const map: Record<string, CrmUserChip> = {}
  for (const id of unique) {
    map[id] = { id, name: id.slice(0, 8) + '…' }
  }

  if (!result.success || !result.data) return map

  for (const row of result.data as Record<string, unknown>[]) {
    const data = (row.data ?? row) as Record<string, unknown>
    const id = String(row.id ?? data.id ?? '')
    if (!id) continue
    const name =
      String(data.name || data.displayName || data.email || id).trim() || id
    map[id] = {
      id,
      name,
      email: data.email ? String(data.email) : null,
      photoURL: (data.photoURL || data.image || data.avatar
        ? String(data.photoURL || data.image || data.avatar)
        : null) as string | null,
    }
  }
  return map
}
