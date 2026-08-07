import type { Entity, SerializedEntity } from '@/features/entities/types'

/** Shape returned by `DatabaseService.execute('query', …)` for collection rows. */
export type DbEntityQueryRow = { id: string; data: Record<string, unknown> }

/** Normalize PG / legacy Firestore timestamp shapes to ISO strings. */
export function entityTimestampToISO(timestamp: unknown): string {
  if (
    timestamp &&
    typeof timestamp === 'object' &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
  ) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString()
  }
  if (timestamp instanceof Date) return timestamp.toISOString()
  if (typeof timestamp === 'string') return timestamp
  return new Date().toISOString()
}

/** Map DatabaseService row → domain Entity (PostgreSQL path; dates as ISO strings cast). */
export function mapDbRowToEntity(id: string, raw: Record<string, unknown>): Entity {
  return {
    ...raw,
    id,
    dateAdded: entityTimestampToISO(raw.dateAdded),
    lastUpdated: entityTimestampToISO(raw.lastUpdated),
    memberSince: raw.memberSince ? entityTimestampToISO(raw.memberSince) : undefined,
  } as unknown as Entity
}

export function mapDbRowToSerializedEntity(
  id: string,
  raw: Record<string, unknown>,
): SerializedEntity {
  return {
    ...(raw as unknown as SerializedEntity),
    id,
    dateAdded: entityTimestampToISO(raw.dateAdded),
    lastUpdated: entityTimestampToISO(raw.lastUpdated),
    memberSince: raw.memberSince ? entityTimestampToISO(raw.memberSince) : undefined,
  }
}

/** Map a DatabaseService query row → `SerializedEntity`. */
export function mapDbQueryRowToSerializedEntity(item: DbEntityQueryRow): SerializedEntity {
  return mapDbRowToSerializedEntity(item.id, item.data)
}

/** Map flat `{ id, …fields }` documents from `db.query()` results. */
export function mapDbDocumentToSerializedEntity(
  doc: Record<string, unknown> & { id: string },
): SerializedEntity {
  const { id, ...data } = doc
  return mapDbRowToSerializedEntity(id, data)
}
