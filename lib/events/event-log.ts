import { getAdminDb } from '@/lib/firebase-admin.server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

export interface EventRecord<T = any> {
  id?: string
  type: string
  payload: T
  userId?: string
  reversible?: boolean
  timeMs: number
  ts: Timestamp | FieldValue
  meta?: Record<string, unknown>
}

export interface EventQuery {
  sinceMs?: number
  untilMs?: number
  typeIn?: string[]
  userId?: string
  limit?: number
}

export async function appendEvent<T>(event: Omit<EventRecord<T>, 'id' | 'timeMs' | 'ts'>): Promise<string> {
  const db = await getAdminDb()
  const toWrite: EventRecord<T> = {
    ...event,
    timeMs: Date.now(),
    ts: FieldValue.serverTimestamp(),
  }
  const ref = await db.collection('events').add(toWrite as any)
  return ref.id
}

export async function appendEventsBatch<T>(events: Array<Omit<EventRecord<T>, 'id' | 'timeMs' | 'ts'>>): Promise<string[]> {
  if (!events.length) return []
  const db = await getAdminDb()
  const writer = db.bulkWriter()
  const ids: string[] = []
  for (const e of events) {
    const ref = db.collection('events').doc()
    const toWrite: EventRecord<T> = { ...e, timeMs: Date.now(), ts: FieldValue.serverTimestamp() }
    writer.create(ref, toWrite as any)
    ids.push(ref.id)
  }
  await writer.close()
  return ids
}

export async function getEvents(query: EventQuery = {}): Promise<EventRecord[]> {
  const db = await getAdminDb()
  let q: FirebaseFirestore.Query = db.collection('events')
  if (query.sinceMs != null) q = q.where('timeMs', '>=', query.sinceMs)
  if (query.untilMs != null) q = q.where('timeMs', '<=', query.untilMs)
  if (query.userId) q = q.where('userId', '==', query.userId)
  if (query.typeIn && query.typeIn.length) q = q.where('type', 'in', query.typeIn)
  q = q.orderBy('timeMs', 'asc')
  if (query.limit) q = q.limit(query.limit)
  const snap = await q.get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export async function getEventsSince(sinceMs: number, type?: string): Promise<EventRecord[]> {
  return getEvents({ sinceMs, typeIn: type ? [type] : undefined })
}

export async function getEventsBetween(startMs: number, endMs: number): Promise<EventRecord[]> {
  return getEvents({ sinceMs: startMs, untilMs: endMs })
}

export async function replayEvents(fromDate: Date, apply: (e: EventRecord) => Promise<void> | void, filter?: Omit<EventQuery, 'sinceMs'>): Promise<void> {
  const events = await getEvents({ sinceMs: fromDate.getTime(), ...(filter || {}) })
  for (const e of events) {
    await apply(e)
  }
}



