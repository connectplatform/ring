import type { Message } from '@/features/chat/types'

/**
 * Normalize various timestamp shapes (Firestore Timestamp, Date, ISO string, number) to milliseconds.
 */
export function getMessageTimeMs(ts: Message['timestamp'] | undefined | null): number {
  if (ts == null) return 0
  const t = ts as unknown as { toMillis?: () => number }
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t === 'object' && t !== null && '_seconds' in t) {
    return Number((t as { _seconds: number })._seconds) * 1000
  }
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts === 'string') return new Date(ts).getTime()
  if (typeof ts === 'number') return ts
  return 0
}
