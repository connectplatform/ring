import type { Opportunity, SerializedOpportunity } from '@/features/opportunities/types'

/** Shape returned by `DatabaseService.execute('query', …)` for collection rows. */
export type DbOpportunityQueryRow = { id: string; data: Record<string, unknown> }

/** Normalize PG / legacy Firestore timestamp shapes to ISO strings. */
export function opportunityTimestampToISO(timestamp: unknown): string {
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

/** Map DatabaseService row → domain Opportunity (PostgreSQL path). */
export function mapDbRowToOpportunity(
  id: string,
  raw: Record<string, unknown>,
): Opportunity {
  return {
    ...raw,
    id,
    dateCreated: opportunityTimestampToISO(raw.dateCreated),
    dateUpdated: opportunityTimestampToISO(raw.dateUpdated),
    expirationDate: opportunityTimestampToISO(raw.expirationDate),
    applicationDeadline: raw.applicationDeadline
      ? opportunityTimestampToISO(raw.applicationDeadline)
      : undefined,
  } as unknown as Opportunity
}

export function mapDbRowToSerializedOpportunity(
  id: string,
  raw: Record<string, unknown>,
): SerializedOpportunity {
  return {
    ...(raw as unknown as SerializedOpportunity),
    id,
    dateCreated: opportunityTimestampToISO(raw.dateCreated),
    dateUpdated: opportunityTimestampToISO(raw.dateUpdated),
    expirationDate: opportunityTimestampToISO(raw.expirationDate),
    applicationDeadline: raw.applicationDeadline
      ? opportunityTimestampToISO(raw.applicationDeadline)
      : undefined,
  }
}

/** Map a DatabaseService query row → `SerializedOpportunity` (PostgreSQL / JSONB path). */
export function mapDbQueryRowToSerializedOpportunity(
  item: DbOpportunityQueryRow,
): SerializedOpportunity {
  return mapDbRowToSerializedOpportunity(item.id, item.data)
}

/** Map flat `{ id, …fields }` documents from `db().*Doc` results. */
export function mapDbDocumentToOpportunity(
  doc: Record<string, unknown> & { id: string },
): Opportunity {
  const { id, ...data } = doc
  return mapDbRowToOpportunity(id, data)
}

export function mapDbDocumentToSerializedOpportunity(
  doc: Record<string, unknown> & { id: string },
): SerializedOpportunity {
  const { id, ...data } = doc
  return mapDbRowToSerializedOpportunity(id, data)
}
