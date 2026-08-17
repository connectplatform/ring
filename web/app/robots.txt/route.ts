import { NextResponse } from 'next/server'

const CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=yes'

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
 * Publisher AI policy via Content-Signal (contentsignals.org) + standard crawl rules.
 * @see https://contentsignals.org/
 */
export async function GET() {
  const origin = siteOrigin()
  const body = [
    '# Ring Platform robots.txt',
    'User-agent: *',
    'Allow: /',
    '',
    `# Content Signals — how automated systems may use fetched bytes`,
    `# search | ai-input | ai-train — see https://contentsignals.org/`,
    `Content-Signal: ${CONTENT_SIGNAL}`,
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
    '# Agent docs index',
    `# See also ${origin}/llms.txt`,
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Signal': CONTENT_SIGNAL,
    },
  })
}
