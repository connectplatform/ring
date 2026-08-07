import { handlers } from '@/auth'
import { connection } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Auth.js v5 route handlers.
 * Await `connection()` so Auth.js + adapter see a live request store (cookies/DB).
 *
 * HEAD/OPTIONS: nginx / probes sometimes hit /api/auth/* with non-GET/POST;
 * Auth.js throws UnknownAction for those — answer safely without invoking handlers.
 */

export async function GET(
  ...args: Parameters<typeof handlers.GET>
) {
  await connection()
  return handlers.GET(...args)
}

export async function POST(
  ...args: Parameters<typeof handlers.POST>
) {
  await connection()
  return handlers.POST(...args)
}

export async function HEAD() {
  return new NextResponse(null, { status: 204 })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, HEAD, OPTIONS',
    },
  })
}
