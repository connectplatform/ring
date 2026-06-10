import { cache } from 'react'
import { auth } from '@/auth'
import { initializeDatabase, getDatabaseService } from '@/lib/database'

export interface UserSearchResult {
  id: string
  username: string | null
  name: string | null
  photoURL: string | null
  isVerified: boolean
}

function toSearchResult(doc: { id: string; data?: Record<string, unknown> }): UserSearchResult | null {
  const data = (doc.data ?? doc) as Record<string, unknown>
  const id = doc.id || (data.id as string)
  if (!id) return null

  return {
    id,
    username: (data.username as string) ?? null,
    name: (data.name as string) ?? null,
    photoURL: (data.photoURL as string) ?? null,
    isVerified: Boolean(data.isVerified),
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

  await initializeDatabase()
  const db = getDatabaseService()
  const requesterId = session.user.id
  const cappedLimit = Math.min(Math.max(limit, 1), 20)

  const [usernameResult, nameResult] = await Promise.all([
    db.query({
      collection: 'users',
      filters: [{ field: 'username', operator: 'ilike', value: `${normalized}%` }],
      pagination: { limit: cappedLimit },
    }),
    db.query({
      collection: 'users',
      filters: [{ field: 'name', operator: 'ilike', value: `%${normalized}%` }],
      pagination: { limit: cappedLimit },
    }),
  ])

  const merged = new Map<string, UserSearchResult>()

  for (const result of [usernameResult, nameResult]) {
    if (!result.success || !result.data) continue
    for (const doc of result.data) {
      const item = toSearchResult(doc)
      if (!item || item.id === requesterId) continue
      merged.set(item.id, item)
      if (merged.size >= cappedLimit) break
    }
    if (merged.size >= cappedLimit) break
  }

  return [...merged.values()]
})
