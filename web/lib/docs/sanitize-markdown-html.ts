/**
 * Allowlist sanitize for residual HTML helpers (tests / defensive sinks).
 * Changelog UI no longer uses an HTML string pipeline — prefer React GFM render.
 * Stricter than news (`sanitizeNewsHtml`); no embeds. `style` attrs are stripped.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'div',
  'span',
])

const ALLOWED_ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'class',
  'target',
  'rel',
  'width',
  'height',
  'loading',
  'colspan',
  'rowspan',
  'align',
])

function sanitizeAttrs(tag: string, attrString: string): string {
  const out: string[] = []
  const re =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrString))) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (name.startsWith('on')) continue
    if (!ALLOWED_ATTRS.has(name)) continue
    if (name === 'href' || name === 'src') {
      const lower = value.trim().toLowerCase()
      if (lower.startsWith('javascript:') || lower.startsWith('data:text')) continue
      if (name === 'href' && !/^(https?:|mailto:|\/|#)/i.test(value.trim())) continue
      if (name === 'src' && !/^(https?:|\/)/i.test(value.trim())) continue
    }
    out.push(`${name}="${value.replace(/"/g, '&quot;')}"`)
  }
  if (tag === 'a' && !out.some((a) => a.startsWith('rel='))) {
    out.push('rel="noopener noreferrer"')
  }
  return out.length ? ` ${out.join(' ')}` : ''
}

/**
 * Strip disallowed tags/attrs from markdown-rendered HTML before DOM insert.
 */
export function sanitizeMarkdownHtml(html: string): string {
  if (!html) return ''
  let cleaned = html.replace(
    /<(script|style|object|embed|form|input|textarea|link|meta|iframe|svg|math)[\s\S]*?<\/\1>/gi,
    '',
  )
  cleaned = cleaned.replace(
    /<(script|style|object|embed|form|input|textarea|link|meta|iframe|svg|math)[^>]*\/?>/gi,
    '',
  )

  return cleaned.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g,
    (full, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase()
      const isClose = full.startsWith('</')
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (isClose) return `</${tag}>`
      const selfClosing =
        /\/>\s*$/.test(full) || tag === 'br' || tag === 'hr' || tag === 'img'
      const safeAttrs = sanitizeAttrs(tag, attrs || '')
      return selfClosing ? `<${tag}${safeAttrs} />` : `<${tag}${safeAttrs}>`
    },
  )
}
