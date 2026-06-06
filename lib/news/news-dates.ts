/** Normalize Firestore Timestamp, ISO string, or Date from JSONB news documents. */
export function toNewsDate(value: unknown): Date {
  if (value == null) return new Date(0)
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.toDate === 'function') {
      return (record.toDate as () => Date)()
    }
    if (typeof record._seconds === 'number') {
      return new Date(record._seconds * 1000)
    }
  }
  const fallback = new Date(String(value))
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback
}

export function toNewsIsoDate(value: unknown): string | undefined {
  const date = toNewsDate(value)
  if (date.getTime() === 0) return undefined
  return date.toISOString()
}
