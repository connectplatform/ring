import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { z } from 'zod'
import { trackRefcodeVisit } from '@/features/refcodes/services/attribution-service'

const schema = z.object({
  code: z.string().min(1).max(64),
})

export async function POST(request: NextRequest) {
  await connection()

  try {
    const body = schema.parse(await request.json())
    const result = await trackRefcodeVisit(body.code)
    if (!result.ok) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }
    return NextResponse.json({ ok: true, visits: result.visits })
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }
}
