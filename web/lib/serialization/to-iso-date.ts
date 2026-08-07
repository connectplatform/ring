/**
 * Neutral ISO date normalization for DB rows, RSC boundaries, MCP, and (Phase 2) adapters.
 * Handles Firestore Timestamp, JS Date, ISO strings, epoch ms, and legacy {_seconds} JSON.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fromSecondsObject(value: Record<string, unknown>): string | undefined {
  const seconds = value._seconds ?? value.seconds
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return new Date(seconds * 1000).toISOString()
  }
  return undefined
}

/**
 * Convert an unknown date-like value to an ISO 8601 string.
 * Uses a lenient fallback (current time) for malformed values to match legacy serializers.
 */
export function toIsoDate(value: unknown): string {
  if (value == null || value === '') {
    return new Date().toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      const parsed = Date.parse(trimmed)
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString()
      }
    }
    return new Date().toISOString()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (isRecord(value)) {
    if (typeof value.toDate === 'function') {
      try {
        const date = value.toDate()
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          return date.toISOString()
        }
      } catch {
        // fall through to other shapes / fallback
      }
    }

    const fromSeconds = fromSecondsObject(value)
    if (fromSeconds) {
      return fromSeconds
    }
  }

  return new Date().toISOString()
}

/** Like {@link toIsoDate} but returns undefined for null/undefined/empty input. */
export function toIsoDateOrUndefined(value: unknown): string | undefined {
  if (value == null || value === '') {
    return undefined
  }
  return toIsoDate(value)
}
