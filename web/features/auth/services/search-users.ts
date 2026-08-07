import { cache } from 'react'
import { auth } from '@/auth'
import { db } from '@/lib/database'

export interface UserSearchResult {
  id: string
  username: string | null
  name: string | null
  photoURL: string | null
  isVerified: boolean
}

function toSearchResult(row: Record<string, unknown> & { id: string }): UserSearchResult | null {
  if (!row.id) return null

  return {
    id: row.id,
    username: (row.username as string) ?? null,
    name: (row.name as string) ?? null,
    photoURL: (row.photoURL as string) ?? null,
    isVerified: Boolean(row.isVerified),
  }
}

export const searchUsers = cache(async (term: string, limit = 8): Promise<UserSearchResult[]> => {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  const normalized = term.trim().toLowerCase()
  if (normalized.length < 2) {
    return []
  }

  const requesterId = session.user.id
  const cappedLimit = Math.min(Math.max(limit, 1), 20)

  const [usernameResult, nameResult] = await Promise.all([
    db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'username', operator: 'ilike', value: `${normalized}%` }],
      pagination: { limit: cappedLimit },
    }),
    db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      filters: [{ field: 'name', operator: 'ilike', value: `%${normalized}%` }],
      pagination: { limit: cappedLimit },
    }),
  ])

  const merged = new Map<string, UserSearchResult>()

  for (const result of [usernameResult, nameResult]) {
    if (!result.success) continue
    for (const row of result.data) {
      const item = toSearchResult(row)
      if (!item || item.id === requesterId) continue
      merged.set(item.id, item)
      if (merged.size >= cappedLimit) break
    }
    if (merged.size >= cappedLimit) break
  }

  return [...merged.values()]
})
