import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService'

export interface EventRecord<T = any> {
  id?: string
  type: string
  payload: T
  userId?: string
  reversible?: boolean
  timeMs: number
  ts: Date
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
  await initializeDatabase()
  const db = getDatabaseService()
  const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const toWrite: EventRecord<T> = {
    ...event,
    timeMs: Date.now(),
    ts: new Date(),
  }
  const result = await db.create('events', toWrite, { id: eventId })
  if (!result.success) {
    throw new Error('Failed to create event')
  }
  return eventId
}

export async function appendEventsBatch<T>(events: Array<Omit<EventRecord<T>, 'id' | 'timeMs' | 'ts'>>): Promise<string[]> {
  if (!events.length) return []
  await initializeDatabase()
  const db = getDatabaseService()
  const ids: string[] = []

  // Create events sequentially (DatabaseService doesn't have batch operations yet)
  for (const e of events) {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const toWrite: EventRecord<T> = { ...e, timeMs: Date.now(), ts: new Date() }
    const result = await db.create('events', toWrite, { id: eventId })
    if (result.success) {
      ids.push(eventId)
    }
  }
  return ids
}

export async function getEvents(query: EventQuery = {}): Promise<EventRecord[]> {
  await initializeDatabase()
  const db = getDatabaseService()
  const result = await db.query({ collection: 'events' })

  if (!result.success || !result.data) {
    return []
  }

  // Apply filters manually since DatabaseService query API is simpler
  let events = result.data.filter((event: any) => {
    if (query.sinceMs != null && event.timeMs < query.sinceMs) return false
    if (query.untilMs != null && event.timeMs > query.untilMs) return false
    if (query.userId && event.userId !== query.userId) return false
    if (query.typeIn && query.typeIn.length && !query.typeIn.includes(event.type)) return false
    return true
  })

  // Sort by timeMs ascending
  events.sort((a: any, b: any) => a.timeMs - b.timeMs)

  // Apply limit
  if (query.limit) {
    events = events.slice(0, query.limit)
  }

  return events.map((event: any) => ({ id: event.id, ...event }))
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



