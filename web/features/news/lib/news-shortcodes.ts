/**
 * News body widget shortcodes (WP-style square brackets).
 * Reserved prefixes only — must not collide with wiki [[wikilinks]].
 *
 * Grammar (SSOT):
 *   [[mood:PLAYLIST_ID]]
 *   [[embed:URL]] optional |title|image|provider|embedId
 *   [[video:SRC]] optional |poster|fileId
 * Images stay standard Markdown: ![alt](url)
 */

import {
  detectEmbedFromUrl,
  rumbleEmbedSrc,
  youtubeEmbedSrc,
  type EmbedProvider,
} from '@/features/news/lib/editor-widget-detector'

export type NewsShortcodeKind = 'mood' | 'embed' | 'video'

export type NewsShortcodeSlot = {
  kind: NewsShortcodeKind
  value: string
}

/** Matches [[mood:…]] / [[embed:…]] / [[video:…]] (case-insensitive kind). */
export const NEWS_SHORTCODE_RE = /\[\[(mood|embed|video):([^\]]+)\]\]/gi

const PLACEHOLDER = (i: number) => `%%NEWS_SC_${i}%%`

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

function splitFields(value: string): string[] {
  return String(value || '')
    .split('|')
    .map((p) => p.trim())
}

/** Extract reserved shortcodes → placeholders before markdown/wiki codec. */
export function extractNewsShortcodes(markdown: string): {
  masked: string
  slots: NewsShortcodeSlot[]
} {
  const slots: NewsShortcodeSlot[] = []
  const masked = (markdown || '').replace(
    NEWS_SHORTCODE_RE,
    (_full, kindRaw: string, rawValue: string) => {
      const kind = String(kindRaw).toLowerCase() as NewsShortcodeKind
      const value = String(rawValue || '').trim()
      const idx = slots.length
      slots.push({ kind, value })
      return PLACEHOLDER(idx)
    },
  )
  return { masked, slots }
}

function embedToHtml(value: string): string {
  const [urlRaw, titleOpt, imageOpt, providerOpt, embedIdOpt] = splitFields(value)
  const url = urlRaw || ''
  if (!url || !/^https?:\/\//i.test(url)) {
    return (
      `<div class="news-shortcode-embed my-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">` +
      `<strong class="text-foreground">Embed</strong>` +
      `<span class="mx-1">·</span>` +
      `<code class="text-xs">${escapeHtml(url || 'invalid')}</code>` +
      `</div>`
    )
  }

  const detected = detectEmbedFromUrl(url)
  const provider = (providerOpt as EmbedProvider) || detected.provider
  const embedId = embedIdOpt || detected.embedId || ''
  const title = titleOpt || ''
  const image = imageOpt || ''
  const canonicalUrl = detected.canonicalUrl || url

  const commonAttrs =
    ` class="ring-embed my-4 block"` +
    ` data-provider="${escapeAttr(provider)}"` +
    ` data-canonical-url="${escapeAttr(canonicalUrl)}"` +
    (embedId ? ` data-embed-id="${escapeAttr(embedId)}"` : '') +
    (title ? ` data-title="${escapeAttr(title)}"` : '') +
    (image ? ` data-image="${escapeAttr(image)}"` : '')

  if (provider === 'youtube' && embedId) {
    return (
      `<ring-embed${commonAttrs}>` +
      `<iframe src="${escapeAttr(youtubeEmbedSrc(embedId))}" width="560" height="315" ` +
      `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
      `allowfullscreen="true" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ` +
      `class="ring-embed-iframe max-w-full"></iframe>` +
      `</ring-embed>`
    )
  }

  if (provider === 'rumble') {
    return (
      `<ring-embed${commonAttrs}>` +
      `<iframe src="${escapeAttr(rumbleEmbedSrc(canonicalUrl))}" width="640" height="360" ` +
      `allowfullscreen="true" loading="lazy" class="ring-embed-iframe max-w-full"></iframe>` +
      `</ring-embed>`
    )
  }

  // Card fallback (x, facebook, suno, generic_og)
  const label = title || canonicalUrl
  const thumb = image
    ? `<img src="${escapeAttr(image)}" alt="" class="ring-embed-card-image mb-2 max-h-40 w-full object-cover rounded-md" loading="lazy" />`
    : ''
  return (
    `<ring-embed${commonAttrs}>` +
    `<a href="${escapeAttr(canonicalUrl)}" target="_blank" rel="noopener noreferrer" class="ring-embed-card block rounded-md border border-border p-3 no-underline hover:bg-muted/40">` +
    thumb +
    `<span class="font-medium text-foreground">${escapeHtml(label)}</span>` +
    (title
      ? `<span class="mt-1 block text-xs text-muted-foreground break-all">${escapeHtml(canonicalUrl)}</span>`
      : '') +
    `</a>` +
    `</ring-embed>`
  )
}

function videoToHtml(value: string): string {
  const [srcRaw, posterOpt, fileIdOpt] = splitFields(value)
  const src = srcRaw || ''
  if (!src || !/^(https?:|\/)/i.test(src)) {
    return (
      `<div class="news-shortcode-video my-4 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">` +
      `Invalid video source` +
      `</div>`
    )
  }
  return (
    `<video src="${escapeAttr(src)}" ` +
    (posterOpt ? `poster="${escapeAttr(posterOpt)}" ` : '') +
    (fileIdOpt ? `data-file-id="${escapeAttr(fileIdOpt)}" ` : '') +
    `controls="true" playsinline="true" preload="metadata" class="ring-video my-4 max-w-full rounded-md"></video>`
  )
}

function moodToHtml(value: string): string {
  const id = splitFields(value)[0] || ''
  if (!id) {
    return `<div class="news-shortcode-mood my-4 text-sm text-muted-foreground">Mood playlist missing</div>`
  }
  return (
    `<ring-mood-player playlist="${escapeAttr(id)}" show-lyrics="true" class="my-4 block"></ring-mood-player>`
  )
}

/** Live HTML for public render (custom elements + allowlisted iframes/video). */
export function shortcodeSlotToHtml(slot: NewsShortcodeSlot): string {
  if (slot.kind === 'mood') return moodToHtml(slot.value)
  if (slot.kind === 'video') return videoToHtml(slot.value)
  return embedToHtml(slot.value)
}

export function restoreNewsShortcodePlaceholders(
  html: string,
  slots: NewsShortcodeSlot[],
): string {
  let out = html
  slots.forEach((slot, idx) => {
    const token = PLACEHOLDER(idx)
    const replacement = shortcodeSlotToHtml(slot)
    const pWrapped = new RegExp(
      `<p>\\s*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</p>`,
      'g',
    )
    out = out.replace(pWrapped, replacement)
    out = out.split(token).join(replacement)
    out = out.split(escapeHtml(token)).join(replacement)
  })
  return out
}

/** Insert a shortcode at the end of the markdown body. */
export function appendNewsShortcode(
  markdown: string,
  kind: NewsShortcodeKind,
  value: string,
): string {
  const trimmed = (value || '').trim()
  if (!trimmed) return markdown || ''
  const tag = `[[${kind}:${trimmed}]]`
  const base = markdown || ''
  if (!base.trim()) return tag
  return `${base.replace(/\s+$/, '')}\n\n${tag}\n`
}

/** Build embed shortcode; optional OG fields after URL. */
export function buildEmbedShortcode(
  url: string,
  meta?: { title?: string; image?: string; provider?: string; embedId?: string },
): string {
  const detected = detectEmbedFromUrl(url)
  const canonical = detected.canonicalUrl || url.trim()
  const parts = [canonical]
  if (meta?.title || meta?.image || meta?.provider || meta?.embedId) {
    parts.push(meta.title || '')
    parts.push(meta.image || '')
    parts.push(meta.provider || detected.provider)
    parts.push(meta.embedId || detected.embedId || '')
  }
  // Trim trailing empty pipes
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop()
  return `[[embed:${parts.join('|')}]]`
}

export function buildVideoShortcode(
  src: string,
  meta?: { poster?: string; fileId?: string },
): string {
  const parts = [src.trim()]
  if (meta?.poster || meta?.fileId) {
    parts.push(meta.poster || '')
    parts.push(meta.fileId || '')
  }
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop()
  return `[[video:${parts.join('|')}]]`
}

export function buildMoodShortcode(playlistId: string): string {
  return `[[mood:${playlistId.trim()}]]`
}
