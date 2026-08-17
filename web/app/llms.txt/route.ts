import { NextResponse } from 'next/server'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { scanDocsStaticParams } from '@/lib/docs/docs-path'
import { buildDocsHref, buildDocsLinkPath } from '@/lib/docs/docs-path-url'
import { getDocTitleFromFile, readDocMatter } from '@/lib/docs/docs-article'
import { resolveDocFilePath } from '@/lib/docs/docs-path'
import { buildDocsMarkdownHref } from '@/lib/docs/docs-path-url'

function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'https://ring-platform.org'
  return raw.replace(/\/$/, '')
}

/**
 * Industry-aligned /llms.txt — curated Markdown index.
 * Primary links: per-article `.md` twin. Structured NODUS at same path + `/nodus.json`.
 * @see https://llmstxt.org/
 */
export async function GET() {
  const origin = siteOrigin()
  const locale = DEFAULT_LOCALE
  const params = scanDocsStaticParams()

  const lines: string[] = [
    '# Ring Platform',
    '',
    '> Open-source collaboration platform (Next.js, Auth.js, PostgreSQL) — docs for founders and developers.',
    '',
    'Human HTML: /docs',
    'Agent prose twin: append `.md` to any docs URL (also `Accept: text/markdown`).',
    'Structured NODUS JSON: append `/nodus.json` to any docs URL.',
    'Discovery: /.well-known/agent.json → this file.',
    '',
    '## Documentation',
    '',
  ]

  const seen = new Set<string>()
  for (const p of params) {
    const slug = p.slug ?? []
    const key = slug.join('/') || 'index'
    if (seen.has(key)) continue
    seen.add(key)

    const { filePath } = resolveDocFilePath(locale, slug)
    let title = slug.length ? slug[slug.length - 1]! : 'Docs home'
    let note = ''
    if (filePath) {
      title = getDocTitleFromFile(filePath, title)
      const matter = readDocMatter(filePath)
      if (matter?.data.description && typeof matter.data.description === 'string') {
        note = matter.data.description.replace(/\s+/g, ' ').slice(0, 120)
      }
    }

    const href = `${origin}${buildDocsMarkdownHref(locale, slug)}`
    const displayPath = buildDocsLinkPath(slug)
    if (note) {
      lines.push(`- [${title}](${href}): ${note}`)
    } else {
      lines.push(`- [${title}](${href}): ${displayPath}`)
    }
  }

  lines.push('')
  lines.push('## Structured NODUS')
  lines.push('')
  lines.push(
    `Append \`/nodus.json\` to any docs path for concept-class JSON (e.g. ${origin}/docs/features/media-conductor/nodus.json).`,
  )
  lines.push('')
  lines.push('## Optional')
  lines.push('')
  lines.push(
    `- [MediaConductor](${origin}${buildDocsMarkdownHref(locale, ['features', 'media-conductor'])}): Docs narration + walkthrough conductors`,
  )
  lines.push(`- [Agent handshake](${origin}/.well-known/agent.json)`)
  lines.push(`- [robots.txt + Content-Signal](${origin}/robots.txt)`)
  lines.push('')

  const body = lines.join('\n')
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      Link: `</llms.txt>; rel="describedby", </.well-known/agent.json>; rel="alternate"`,
    },
  })
}
