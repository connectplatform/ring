/**
 * Pure Accept negotiation for docs markdown twins (no fs / server-only).
 * Safe for proxy.ts and unit tests.
 */

/** Prefer text/markdown only when its q is strictly greater than text/html (agents). */
export function acceptPrefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  let mdQ = -1
  let htmlQ = -1
  for (const part of acceptHeader.split(',')) {
    const segments = part.trim().split(';')
    const type = (segments[0] || '').trim().toLowerCase()
    let q = 1
    for (let i = 1; i < segments.length; i++) {
      const m = /q\s*=\s*([0-9.]+)/i.exec(segments[i] || '')
      if (m) q = Number.parseFloat(m[1]!)
    }
    if (Number.isNaN(q)) q = 1
    if (type === 'text/markdown') mdQ = Math.max(mdQ, q)
    if (type === 'text/html' || type === 'application/xhtml+xml') htmlQ = Math.max(htmlQ, q)
  }
  if (mdQ < 0) return false
  if (htmlQ < 0) return mdQ > 0
  return mdQ > htmlQ
}
