/**
 * Markdown ↔ TipTap HTML codec for Admin Wiki.
 * Preserves [[wikilinks]] as data-wiki-* anchors through the round-trip.
 * Body SSOT remains Markdown (not TipTap news HTML).
 */
import { parseWikiLinkInner, mapWikiLinksOutsideCode } from '@/features/wiki/wikilink-parser'

const WIKILINK_PLACEHOLDER = (i: number) => `%%WIKI${i}%%`

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

function inlineFormat(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>',
    )
}

/** GFM table row: | a | b | */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c))
}

function renderTable(header: string[], rows: string[][]): string {
  const th = header
    .map((c) => `<th><p>${inlineFormat(c)}</p></th>`)
    .join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td><p>${inlineFormat(c)}</p></td>`).join('')}</tr>`,
    )
    .join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
}

/** Lightweight Markdown → HTML (GFM subset) for TipTap setContent. */
export function simpleMarkdownToHtml(src: string): string {
  const lines = src.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inCode = false
  let codeBuf: string[] = []
  let i = 0

  const flushLists = () => {
    if (inUl) {
      out.push('</ul>')
      inUl = false
    }
    if (inOl) {
      out.push('</ol>')
      inOl = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        flushLists()
        inCode = true
      }
      i += 1
      continue
    }
    if (inCode) {
      codeBuf.push(escapeHtml(line))
      i += 1
      continue
    }

    // GFM table: header + separator + rows
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      flushLists()
      const header = splitTableRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]))
        i += 1
      }
      out.push(renderTable(header, rows))
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushLists()
      const level = Math.min(heading[1].length, 6)
      out.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      if (inOl) {
        out.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        out.push('<ul>')
        inUl = true
      }
      out.push(`<li><p>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</p></li>`)
      i += 1
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        out.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        out.push('<ol>')
        inOl = true
      }
      out.push(`<li><p>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</p></li>`)
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      flushLists()
      out.push(`<blockquote><p>${inlineFormat(line.replace(/^>\s?/, ''))}</p></blockquote>`)
      i += 1
      continue
    }

    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      flushLists()
      out.push('<hr>')
      i += 1
      continue
    }

    flushLists()
    if (!line.trim()) {
      i += 1
      continue
    }
    out.push(`<p>${inlineFormat(line)}</p>`)
    i += 1
  }
  flushLists()
  if (inCode) out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
  return out.join('')
}

export function markdownToEditorHtml(markdown: string): string {
  const tokens: Array<ReturnType<typeof parseWikiLinkInner>> = []
  // Only promote live wikilinks — keep [[examples]] inside code as plain text
  const stubbed = mapWikiLinksOutsideCode(markdown || '', (_full, inner) => {
    const idx = tokens.length
    tokens.push(parseWikiLinkInner(inner))
    return WIKILINK_PLACEHOLDER(idx)
  })
  let html = simpleMarkdownToHtml(stubbed)
  tokens.forEach((link, idx) => {
    const label =
      link.linkKind === 'tenant_ref' ? `@${link.display}` : link.display
    const cls =
      link.linkKind === 'tenant_ref'
        ? 'wiki-link wiki-link-tenant text-primary underline'
        : 'wiki-link wiki-link-local text-primary underline'
    const anchor = `<a class="${cls}" href="#wiki/${encodeURIComponent(link.target)}" data-wiki-kind="${link.linkKind}" data-wiki-target="${escapeAttr(link.target)}" data-wiki-raw="${escapeAttr(link.raw)}">${escapeHtml(label)}</a>`
    html = html.split(WIKILINK_PLACEHOLDER(idx)).join(anchor)
    html = html.split(escapeHtml(WIKILINK_PLACEHOLDER(idx))).join(anchor)
  })
  return html || '<p></p>'
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = Array.from(el.childNodes).map(serializeInline).join('')

  if (tag === 'strong' || tag === 'b') return `**${inner}**`
  if (tag === 'em' || tag === 'i') return `*${inner}*`
  if (tag === 'code') return `\`${inner}\``
  if (tag === 'br') return '\n'
  if (tag === 'a') {
    const wikiRaw = el.getAttribute('data-wiki-raw')
    if (wikiRaw) return wikiRaw
    const kind = el.getAttribute('data-wiki-kind')
    const target = el.getAttribute('data-wiki-target')
    if (kind && target) {
      if (kind === 'tenant_ref') return `[[@${target}]]`
      return `[[${target}]]`
    }
    const href = el.getAttribute('href') || ''
    if (href.startsWith('#wiki/')) {
      return `[[${decodeURIComponent(href.slice(6))}]]`
    }
    if (href) return `[${inner}](${href})`
    return inner
  }
  return inner
}

function cellText(el: HTMLElement): string {
  return Array.from(el.childNodes).map(serializeInline).join('').trim()
}

function serializeTable(table: HTMLElement): string {
  const rows: string[][] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
      cellText(c as HTMLElement),
    )
    if (cells.length) rows.push(cells)
  })
  if (!rows.length) return ''
  const [header, ...body] = rows
  const width = Math.max(...rows.map((r) => r.length), 1)
  const pad = (r: string[]) =>
    Array.from({ length: width }, (_, i) => r[i] ?? '')
  const h = pad(header)
  const sep = h.map(() => '---')
  const lines = [
    `| ${h.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...body.map((r) => `| ${pad(r).join(' | ')} |`),
  ]
  return `${lines.join('\n')}\n\n`
}

function serializeBlock(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  const inline = () => Array.from(el.childNodes).map(serializeInline).join('')

  if (tag === 'h1') return `# ${inline()}\n\n`
  if (tag === 'h2') return `## ${inline()}\n\n`
  if (tag === 'h3') return `### ${inline()}\n\n`
  if (tag === 'h4') return `#### ${inline()}\n\n`
  if (tag === 'h5') return `##### ${inline()}\n\n`
  if (tag === 'h6') return `###### ${inline()}\n\n`
  if (tag === 'p') {
    const text = inline().trim()
    return text ? `${text}\n\n` : ''
  }
  if (tag === 'blockquote') {
    const text = inline().trim()
    return text
      ? text
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n') + '\n\n'
      : ''
  }
  if (tag === 'pre') {
    const code = el.querySelector('code')
    const body = (code?.textContent || el.textContent || '').replace(/\n$/, '')
    return `\`\`\`\n${body}\n\`\`\`\n\n`
  }
  if (tag === 'table') return serializeTable(el)
  if (tag === 'ul') {
    return (
      Array.from(el.children)
        .map((li) => `- ${Array.from(li.childNodes).map(serializeInline).join('').trim()}`)
        .join('\n') + '\n\n'
    )
  }
  if (tag === 'ol') {
    return (
      Array.from(el.children)
        .map(
          (li, i) =>
            `${i + 1}. ${Array.from(li.childNodes).map(serializeInline).join('').trim()}`,
        )
        .join('\n') + '\n\n'
    )
  }
  if (tag === 'hr') return '---\n\n'
  if (tag === 'div' || tag === 'span') {
    return Array.from(el.childNodes)
      .map((n) =>
        n.nodeType === Node.ELEMENT_NODE
          ? serializeBlock(n as HTMLElement)
          : serializeInline(n),
      )
      .join('')
  }
  return inline()
}

/** TipTap HTML → Markdown (client-only; uses DOMParser). */
export function editorHtmlToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html
  }
  const doc = new DOMParser().parseFromString(
    `<div id="wiki-root">${html}</div>`,
    'text/html',
  )
  const root = doc.getElementById('wiki-root')
  if (!root) return ''
  let md = ''
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      md += serializeBlock(child as HTMLElement)
    } else if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent || '').trim()
      if (t) md += `${t}\n\n`
    }
  }
  return md.replace(/\n{3,}/g, '\n\n').trimEnd() + (md ? '\n' : '')
}
