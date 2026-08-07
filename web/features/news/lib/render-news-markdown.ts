/**
 * News body Markdown → safe HTML for public article pages.
 * Pipeline order (mandatory):
 * 1. Legacy HTML tip → escaped stub (never sanitizeNewsHtml as trusted HTML)
 * 2. Extract [[mood:]] / [[embed:]] / [[video:]] → placeholders
 * 3. simpleMarkdownToHtml (escapes raw text; does not promote wiki links)
 * 4. sanitizeMarkdownHtml on MD-only HTML
 * 5. Restore shortcode widgets (ring-embed / ring-mood-player / video)
 * 6. sanitizeNewsHtml belt (allows iframes + custom elements)
 */
import { simpleMarkdownToHtml } from '@/features/wiki/wiki-markdown-codec'
import { sanitizeMarkdownHtml } from '@/lib/docs/sanitize-markdown-html'
import { sanitizeNewsHtml } from '@/features/news/lib/sanitize-news-html'
import {
  extractNewsShortcodes,
  restoreNewsShortcodePlaceholders,
} from '@/features/news/lib/news-shortcodes'
import type { ContentFormat } from '@/lib/versioning/types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Tip / commit format when present; else content heuristic. */
export function looksLikeLegacyHtml(content: string): boolean {
  const t = (content || '').trim()
  if (!t) return false
  return /^<[a-zA-Z!/][\s\S]{0,240}>/.test(t)
}

export function resolveNewsBodyMode(
  content: string,
  contentFormat?: ContentFormat | string | null,
): 'markdown' | 'legacy_html' {
  if (contentFormat === 'markdown' || contentFormat === 'text') return 'markdown'
  // Tip autosave can rewrite body to Markdown before the next version commit flips format
  if (contentFormat === 'html') {
    return looksLikeLegacyHtml(content) ? 'legacy_html' : 'markdown'
  }
  if (looksLikeLegacyHtml(content)) return 'legacy_html'
  return 'markdown'
}

/** Prefer tip commit format from embedded versions. */
export function tipContentFormatFromVersions(versions?: {
  tipCommitId?: string
  commits?: Array<{ id: string; contentFormat?: string }>
} | null): string | undefined {
  if (!versions?.commits?.length) return undefined
  const tipId = versions.tipCommitId
  const tip = tipId
    ? versions.commits.find((c) => c.id === tipId)
    : undefined
  return tip?.contentFormat ?? versions.commits[versions.commits.length - 1]?.contentFormat
}

function legacyHtmlStub(content: string): string {
  return (
    `<div class="news-legacy-html-stub rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">` +
    `<p class="mb-2 font-medium text-foreground">This article still uses HTML and needs Markdown conversion.</p>` +
    `<pre class="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">${escapeHtml(content || '')}</pre>` +
    `</div>`
  )
}

export type RenderNewsMarkdownResult = {
  html: string
  isLegacyStub: boolean
}

export function renderNewsMarkdownToHtml(
  content: string,
  options?: { contentFormat?: ContentFormat | string | null },
): RenderNewsMarkdownResult {
  const raw = content || ''
  const mode = resolveNewsBodyMode(raw, options?.contentFormat)
  if (mode === 'legacy_html') {
    return { html: legacyHtmlStub(raw), isLegacyStub: true }
  }

  const { masked, slots } = extractNewsShortcodes(raw)
  // Own-line placeholders so widgets are block-level (avoid nesting inside <p>)
  const blocked = masked.replace(/(%%NEWS_SC_\d+%%)/g, '\n\n$1\n\n')
  let html = simpleMarkdownToHtml(blocked)
  html = sanitizeMarkdownHtml(html)
  html = restoreNewsShortcodePlaceholders(html, slots)
  // Final allowlist: MD tags + ring-embed / ring-mood-player / iframe / video
  html = sanitizeNewsHtml(html)
  return { html, isLegacyStub: false }
}
