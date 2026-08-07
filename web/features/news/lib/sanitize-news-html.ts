/**
 * Allowlist sanitize for news article HTML (embeds + common TipTap tags).
 * No external DOMPurify dependency — string-level strip of dangerous tags/attrs.
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
  'strike',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'video',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
  'figure',
  'figcaption',
  'iframe',
  'ring-mood-player',
  'ring-embed',
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
  'referrerpolicy',
  'allow',
  'allowfullscreen',
  'frameborder',
  'controls',
  'playsinline',
  'preload',
  'poster',
  'data-file-id',
  'playlist',
  'show-lyrics',
  'autoplay',
  'data-provider',
  'data-embed-id',
  'data-canonical-url',
  'data-title',
  'data-description',
  'data-image',
])

const IFRAME_HOST_ALLOW = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'youtube.com',
  'rumble.com',
  'www.rumble.com',
]

function isAllowedIframeSrc(src: string): boolean {
  try {
    const u = new URL(src)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return IFRAME_HOST_ALLOW.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function sanitizeAttrs(tag: string, attrString: string): string {
  const out: string[] = []
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrString))) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    if (name.startsWith('on')) continue
    if (!ALLOWED_ATTRS.has(name)) continue
    if (name === 'href' || name === 'src') {
      const lower = value.trim().toLowerCase()
      if (lower.startsWith('javascript:') || lower.startsWith('data:text')) continue
      if (name === 'src' && tag === 'iframe' && !isAllowedIframeSrc(value)) continue
      if (name === 'href' && !/^(https?:|mailto:|\/|#)/i.test(value.trim())) continue
    }
    out.push(`${name}="${value.replace(/"/g, '&quot;')}"`)
  }
  if (tag === 'a' && !out.some((a) => a.startsWith('rel='))) {
    out.push('rel="noopener noreferrer"')
  }
  return out.length ? ` ${out.join(' ')}` : ''
}

/**
 * Strip disallowed tags/attrs from HTML intended for public news render.
 */
export function sanitizeNewsHtml(html: string): string {
  if (!html) return ''
  let cleaned = html.replace(/<(script|style|object|embed|form|input|textarea|link|meta)[\s\S]*?<\/\1>/gi, '')
  cleaned = cleaned.replace(/<(script|style|object|embed|form|input|textarea|link|meta)[^>]*\/?>/gi, '')

  return cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g, (full, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase()
    const isClose = full.startsWith('</')
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (isClose) return `</${tag}>`
    const selfClosing = /\/>\s*$/.test(full) || tag === 'br' || tag === 'hr' || tag === 'img'
    const safeAttrs = sanitizeAttrs(tag, attrs || '')
    return selfClosing ? `<${tag}${safeAttrs} />` : `<${tag}${safeAttrs}>`
  })
}
