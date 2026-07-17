/**
 * POST /api/news/embed-preview — OG metadata for paste/slash embeds.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { detectEmbedFromUrl } from '@/features/news/lib/editor-widget-detector'

const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
const OG_DESC_RE = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
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

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json({ success: false, error: 'url required' }, { status: 400 })
  }

  const detected = detectEmbedFromUrl(url)

  try {
    const response = await fetch(detected.canonicalUrl, {
      headers: { 'User-Agent': 'RingNewsEmbedPreview/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      return NextResponse.json({
        success: true,
        provider: detected.provider,
        canonicalUrl: detected.canonicalUrl,
        embedId: detected.embedId,
      })
    }
    const html = await response.text()
    const title = decodeHtmlEntities(
      html.match(OG_TITLE_RE)?.[1] || html.match(TITLE_RE)?.[1] || '',
    ).trim()
    const description = decodeHtmlEntities(
      html.match(OG_DESC_RE)?.[1] || html.match(META_DESC_RE)?.[1] || '',
    ).trim()
    const image = decodeHtmlEntities(html.match(OG_IMAGE_RE)?.[1] || '').trim()

    return NextResponse.json({
      success: true,
      provider: detected.provider,
      canonicalUrl: detected.canonicalUrl,
      embedId: detected.embedId,
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
    })
  } catch {
    return NextResponse.json({
      success: true,
      provider: detected.provider,
      canonicalUrl: detected.canonicalUrl,
      embedId: detected.embedId,
    })
  }
}
