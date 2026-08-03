/**
 * Stable conversation marker for CRM outbound email ↔ inbound reply threading.
 * Operators paste nothing — every reply body includes this footer so IMAP ingest
 * can attach client replies to the existing support request / email thread.
 */

export const RING_THREAD_MARKER_PREFIX = 'Ring-Support-Thread:'

const MARKER_RE = /Ring-Support-Thread:\s*([^\s<>\]]+)/i
const BRACKET_MARKER_RE = /\[\s*Ring-Support-Thread:\s*([^\s<>\]]+)\s*\]/i

/** Build a plaintext footer operators/clients should leave intact when replying. */
export function formatThreadMarker(threadId: string): string {
  const id = threadId.trim()
  if (!id) return ''
  return `\n\n---\n[${RING_THREAD_MARKER_PREFIX} ${id}]\n`
}

/** Append marker once (idempotent). */
export function appendThreadMarker(body: string, threadId: string): string {
  const id = threadId.trim()
  if (!id) return body
  if (MARKER_RE.test(body)) return body
  return `${body.trimEnd()}${formatThreadMarker(id)}`
}

/** Extract thread id from inbound body / subject / headers blob. */
export function extractThreadMarker(text: string | null | undefined): string | null {
  if (!text) return null
  const bracket = text.match(BRACKET_MARKER_RE)
  if (bracket?.[1]) return bracket[1].trim()
  const plain = text.match(MARKER_RE)
  if (plain?.[1]) return plain[1].trim()
  return null
}

/** Header name for machine-readable thread continuity (alongside body marker). */
export const RING_THREAD_HEADER = 'X-Ring-Support-Thread'
