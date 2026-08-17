import { NextResponse } from 'next/server'

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
 * Thin Agent Handshake discovery → /llms.txt (docs agent index).
 * @see https://agenthandshake.dev/spec (MODE1 content endpoint)
 */
export async function GET() {
  const origin = siteOrigin()
  const body = {
    schema_version: '1.0',
    name: 'Ring Platform',
    description:
      'Open-source collaboration platform docs — markdown twins and NODUS JSON for agents.',
    endpoints: {
      content: `${origin}/llms.txt`,
      documentation: `${origin}/docs`,
    },
    content_types: ['text/markdown', 'application/json', 'text/plain'],
  }

  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
