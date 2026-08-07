import type { ParsedWikiLink, WikiLinkKind } from '@/features/wiki/types'

/** Match [[target]], [[@target]], [[tenant:target]], [[target|display]] */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

/**
 * Mask fenced + inline code so documentation examples like `` `[[slug]]` ``
 * and fenced blocks do not create wiki graph edges / lint noise.
 * Replacement keeps string length so indices stay aligned with the source.
 */
export function maskMarkdownCodeSpans(markdown: string): string {
  let out = markdown || ''
  // Fenced code blocks (``` … ```)
  out = out.replace(/```[\s\S]*?```/g, (block) => ' '.repeat(block.length))
  // Inline code (`…`) — single line
  out = out.replace(/`[^`\n]+`/g, (span) => ' '.repeat(span.length))
  return out
}

/**
 * Replace live wikilinks outside code spans/fences (indices aligned via mask).
 */
export function mapWikiLinksOutsideCode(
  markdown: string,
  replacer: (full: string, inner: string) => string,
): string {
  const source = maskMarkdownCodeSpans(markdown || '')
  let out = ''
  let lastIndex = 0
  const re = new RegExp(WIKILINK_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    out += markdown.slice(lastIndex, m.index)
    const full = markdown.slice(m.index, m.index + m[0].length)
    out += replacer(full, (m[1] || '').trim())
    lastIndex = m.index + m[0].length
  }
  out += markdown.slice(lastIndex)
  return out
}

export function parseWikiLinks(markdown: string): ParsedWikiLink[] {
  const out: ParsedWikiLink[] = []
  const seen = new Set<string>()
  const source = maskMarkdownCodeSpans(markdown)
  let m: RegExpExecArray | null
  const re = new RegExp(WIKILINK_RE.source, 'g')
  while ((m = re.exec(source)) !== null) {
    const inner = m[1]?.trim()
    if (!inner) continue
    const parsed = parseWikiLinkInner(inner)
    const key = `${parsed.linkKind}:${parsed.target}:${parsed.display}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }
  return out
}

export function parseWikiLinkInner(inner: string): ParsedWikiLink {
  const pipe = inner.indexOf('|')
  const left = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim()
  const display = (pipe >= 0 ? inner.slice(pipe + 1) : left).trim() || left

  let linkKind: WikiLinkKind = 'local'
  let target = left

  if (left.startsWith('@')) {
    linkKind = 'tenant_ref'
    target = left.slice(1).trim()
  } else if (/^tenant:/i.test(left)) {
    linkKind = 'tenant_ref'
    target = left.replace(/^tenant:/i, '').trim()
  }

  return {
    raw: `[[${inner}]]`,
    display,
    target,
    linkKind,
  }
}

/**
 * Replace wikilinks with HTML anchors for preview (skips code fences / inline code).
 */
export function renderWikiLinksToHtml(
  markdown: string,
  hrefBuilder: (link: ParsedWikiLink) => string,
): string {
  return mapWikiLinksOutsideCode(markdown, (_full, inner) => {
    const link = parseWikiLinkInner(inner)
    const href = hrefBuilder(link)
    const label =
      link.linkKind === 'tenant_ref' ? `@${link.display}` : link.display
    const cls =
      link.linkKind === 'tenant_ref'
        ? 'wiki-link wiki-link-tenant'
        : 'wiki-link wiki-link-local'
    return `<a class="${cls}" href="${escapeAttr(href)}" data-wiki-kind="${link.linkKind}" data-wiki-target="${escapeAttr(link.target)}">${escapeHtml(label)}</a>`
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}
