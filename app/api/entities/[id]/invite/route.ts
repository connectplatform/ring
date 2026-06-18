import { NextRequest, NextResponse, connection } from 'next/server'
import {
  inviteEntityMember,
  EntityInviteError,
} from '@/features/entities/services/invite-entity-member'
import { EntityOwnershipError } from '@/features/entities/lib/assert-entity-owner'
import { RouteHandlerProps } from '@/types/next-page'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
})

/**
 * POST /api/entities/{id}/invite — add an existing user to entity.members by email.
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

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  try {
    const result = await inviteEntityMember(id, body)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof EntityOwnershipError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    if (error instanceof EntityInviteError) {
      const status = error.message.includes('already') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
