import { NextRequest, NextResponse, connection } from 'next/server'
import {
  requestEntityVerification,
  EntityVerificationError,
} from '@/features/entities/services/request-entity-verification'
import { EntityOwnershipError } from '@/features/entities/lib/assert-entity-owner'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

const bodySchema = z.object({
  note: z.string().max(2000).optional(),
})

/**
 * POST /api/entities/{id}/verify — queue entity for platform verification review.
 */
export async function POST(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>,
) {
  await connection()

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 })
  }

  let note: string | undefined
  try {
    const body = await req.json()
    note = bodySchema.parse(body).note
  } catch {
    // note is optional; ignore malformed empty bodies
  }

  try {
    const result = await requestEntityVerification(id, note)
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof EntityOwnershipError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof EntityVerificationError) {
      const status = error.message.includes('already') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
