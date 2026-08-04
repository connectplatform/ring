import { NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ensureLlmText } from '@/lib/docs/docs-article-enrichment'
import { normalizeDocsSlug } from '@/lib/docs/docs-path-url'
import { logger } from '@/lib/logger'

/**
 * Agent-facing docs article NODUS JSON.
 * Public URL via rewrite: /docs/.../nodus.json → this handler
 * (and /:locale/docs/.../nodus.json).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string; slug?: string[] }> },
) {
  try {
    const { locale: rawLocale, slug: rawSlug } = await context.params
    const locale = (routing.locales.includes(rawLocale as Locale)
      ? (rawLocale as Locale)
      : routing.defaultLocale) as Locale
    const slug = normalizeDocsSlug(rawSlug)

    const llmText = await ensureLlmText({ locale, slug })

    return NextResponse.json(llmText, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
        Vary: 'Accept',
        'Access-Control-Allow-Origin': '*',
        ETag: `"${llmText.source_content_hash}"`,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NODUS generation failed'
    logger.warn('[docs-nodus] GET failed', { error: message })
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json(
      { error: message, object_type: 'docs_article_error' },
      {
        status,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
}
