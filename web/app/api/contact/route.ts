import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { submitPlatformContactInquiry } from '@/features/forms/services/platform-contact-submit'

const ALLOWED_ORIGINS = new Set([
  'https://connect.software',
  'https://www.connect.software',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4175',
])

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    ...(allow ? { 'Access-Control-Allow-Origin': allow } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) })
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Visitor'
  const cleaned = local.replace(/[._+-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Visitor'
}

/** Public entry for the connect.software landing. Same CRM path as /contact. */
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: 'Origin not allowed' }, 403, origin)
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const limit = rateLimit(`contact-api:${ip}`, 5, 60_000)
  if (!limit.ok) {
    return json({ error: 'Too many requests. Please try again in a minute.' }, 429, origin)
  }

  let body: { email?: unknown; message?: unknown; website?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send an email and a message.' }, 400, origin)
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return json({ success: true }, 200, origin)
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!email || !message) {
    return json({ error: 'Email and message are required.' }, 400, origin)
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400, origin)
  }
  if (message.length > 4000) {
    return json({ error: 'Message is too long.' }, 400, origin)
  }

  const result = await submitPlatformContactInquiry({
    name: nameFromEmail(email),
    email,
    message,
    entityId: 'connect.software',
    entityName: 'Connect.Software',
  })

  if (!result.success) {
    return json({ error: result.error || 'Failed to send message. Please try again.' }, 500, origin)
  }
  return json({ success: true }, 200, origin)
}
