import { NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { normalizeDocsSlug } from '@/lib/docs/docs-path-url'
import { buildAgentMarkdown } from '@/lib/docs/mdx-to-agent-markdown'
import { logger } from '@/lib/logger'

const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes'

/**
 * Agent-facing docs article markdown twin.
 * Public URL via rewrite: /docs/...md → this handler (and locale-prefixed).
 * Also served when proxy rewrites Accept: text/markdown on HTML docs URLs.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string; slug?: string[] }> },
) {
  try {
    const { locale: rawLocale, slug: rawSlug } = await context.params
    const locale = (routing.locales.includes(rawLocale as Locale)
      ? (rawLocale as Locale)
      : routing.defaultLocale) as Locale
    const slug = normalizeDocsSlug(rawSlug)

    const result = buildAgentMarkdown(locale, slug)
    const origin = new URL(request.url).origin
    const htmlUrl = `${origin}${result.canonicalPath}`
    const mdUrl = `${origin}${result.markdownPath}`

    return new NextResponse(result.markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        Vary: 'Accept',
        'Access-Control-Allow-Origin': '*',
        ETag: `"${result.contentHash}"`,
        'Content-Signal': CONTENT_SIGNAL,
        Link: `<${htmlUrl}>; rel="canonical", <${mdUrl}>; rel="alternate"; type="text/markdown"`,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Markdown generation failed'
    logger.warn('[docs-markdown] GET failed', { error: message })
    const status = message.includes('not found') || message.includes('unreadable') ? 404 : 500
    return new NextResponse(message, {
      status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
