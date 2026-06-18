import 'server-only'

import type { RingWidgetsCustomLink } from '@/lib/ring-widgets/contact-schema'

const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
const OG_DESC_RE = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
const META_DESC_RE = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Fetch OG/title metadata for a custom link URI (used when saving contact widget config).
 */
export async function fetchLinkOgMetadata(uri: string): Promise<{ name?: string; desc?: string }> {
  try {
    const response = await fetch(uri, {
      headers: { 'User-Agent': 'RingWidgetsContact/1.0' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (!response.ok) return {}
    const html = await response.text()
    const ogTitle = html.match(OG_TITLE_RE)?.[1]
    const ogDesc = html.match(OG_DESC_RE)?.[1]
    const metaDesc = html.match(META_DESC_RE)?.[1]
    const title = html.match(TITLE_RE)?.[1]
    return {
      name: decodeHtmlEntities(ogTitle || title || '').trim() || undefined,
      desc: decodeHtmlEntities(ogDesc || metaDesc || '').trim() || undefined,
    }
  } catch {
    return {}
  }
}

/** Merge user-provided link fields with freshly fetched OG metadata. */
export async function resolveCustomLinkOnSave(
  link: Pick<RingWidgetsCustomLink, 'uri' | 'name' | 'desc'>,
): Promise<RingWidgetsCustomLink> {
  const og = await fetchLinkOgMetadata(link.uri)
  return {
    uri: link.uri,
    name: link.name || og.name || link.uri,
    desc: link.desc || og.desc,
  }
}
