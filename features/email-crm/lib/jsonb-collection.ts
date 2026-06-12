import 'server-only'

import { db } from '@/lib/database'
import type { DatabaseFilter } from '@/lib/database/interfaces/IDatabaseService'

export function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      out[key] = value.toISOString()
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item instanceof Date
          ? item.toISOString()
          : typeof item === 'object' && item !== null
            ? serializeDates(item as Record<string, unknown>)
            : item
      )
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = serializeDates(value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out as T
}

export function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' && value) return new Date(value)
  return null
}

export async function readDoc<T extends Record<string, unknown>>(
  collection: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const result = await db().readDoc<T>(collection, id)
  if (!result.success || !result.data) return null
  return result.data
}

export async function upsertDoc<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  record: Partial<T>,
  defaults?: Partial<T>
): Promise<{ id: string }> {
  const serialized = serializeDates(record as Record<string, unknown>) as Partial<T>

  const existing = await db().readDoc<T>(collection, id)
  if (existing.success && existing.data) {
    await db().updateDoc(collection, id, { ...existing.data, ...serialized })
    return { id }
  }

  const created = await db().createDoc(
    collection,
    serializeDates({ ...defaults, ...record } as Record<string, unknown>) as T,
    { id }
  )
  if (!created.success) {
    throw created.error || new Error(`Failed to create ${collection}/${id}`)
  }
  return { id }
}

export async function queryDocs<T extends Record<string, unknown>>(options: {
  collection: string
  filters?: DatabaseFilter[]
  orderBy?: { field: string; direction: 'asc' | 'desc' }[]
  limit?: number
}): Promise<Array<T & { id: string }>> {
  const result = await db().queryDocs<T>({
    collection: options.collection,
    filters: options.filters ?? [],
    orderBy: options.orderBy?.map((o) => ({ field: o.field, direction: o.direction })),
    pagination: options.limit ? { limit: options.limit } : undefined,
  })
  if (!result.success || !result.data) return []
  return result.data
}

export async function deleteDoc(collection: string, id: string): Promise<boolean> {
  const result = await db().deleteDoc(collection, id)
  return result.success
}
