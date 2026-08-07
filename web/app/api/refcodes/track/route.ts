import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { z } from 'zod'
import { trackRefcodeVisit } from '@/features/refcodes/services/attribution-service'
import {
  REF_COOKIE_MAX_AGE_SECONDS,
  REF_COOKIE_NAME,
  REF_VISIBLE_COOKIE_NAME,
} from '@/features/refcodes/constants'

const schema = z.object({
  code: z.string().min(1).max(64),
  /** When true (hash capture), stamp first-touch cookies if absent. */
  claim: z.boolean().optional(),
})

function stampRefCookies(response: NextResponse, code: string, request: NextRequest) {
  if (request.cookies.get(REF_COOKIE_NAME)?.value) return

  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(REF_COOKIE_NAME, code, {
    maxAge: REF_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure,
  })
  response.cookies.set(REF_VISIBLE_COOKIE_NAME, code, {
    maxAge: REF_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure,
  })
}

/**
 * Visit beacon + optional first-touch claim for `#username` / `?ref=` tags.
 * Hash fragments never reach proxy.ts — client posts here after reading location.hash.
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const body = schema.parse(await request.json())
    const result = await trackRefcodeVisit(body.code)
    if (!result.ok || !result.resolvedCode) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    const response = NextResponse.json({
      ok: true,
      visits: result.visits,
      code: result.resolvedCode,
    })

    if (body.claim !== false) {
      stampRefCookies(response, result.resolvedCode, request)
    }

    return response
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
