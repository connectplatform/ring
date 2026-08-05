/**
 * Shared tag parse/filter helpers for profile Position + Skills tag-clouds.
 */

export const PROFILE_TAG_MIN_CHARS = 3

export function parseProfileTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v || '').trim())
      .filter(Boolean)
  }
  if (typeof raw !== 'string' || !raw.trim()) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean)
      }
    } catch {
      /* fall through */
    }
  }
  return trimmed
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function serializeProfileTags(tags: string[]): string {
  return tags.map((t) => t.trim()).filter(Boolean).join(', ')
}

export function filterProfileTags(
  query: string,
  catalog: readonly string[],
  selected: readonly string[],
  minChars = PROFILE_TAG_MIN_CHARS,
): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < minChars) return []
  const selectedSet = new Set(selected.map((t) => t.toLowerCase()))
  return catalog
    .filter((tag) => {
      const lower = tag.toLowerCase()
      if (selectedSet.has(lower)) return false
      return lower.includes(q)
    })
    .slice(0, 40)
}
