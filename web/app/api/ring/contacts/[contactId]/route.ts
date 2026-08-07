/**
 * Ring Contact by ID — PATCH / DELETE
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getCurrentRingContactsService } from '@/features/contacts/services'
import { readJsonBody } from '@/lib/server/request'
import { z } from 'zod'

const PatchContactSchema = z.object({
  notes: z.string().max(500).optional(),
  isFavorite: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ contactId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contactId } = await context.params
    const body = await readJsonBody(request)
    const parsed = PatchContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const service = getCurrentRingContactsService()
    const contact = await service.patchContact(session.user.id, contactId, parsed.data)

    return NextResponse.json({ contact })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contact'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to patch ring contact:', error)
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { contactId } = await context.params
    const service = getCurrentRingContactsService()
    await service.removeContact(session.user.id, contactId)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove contact'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to delete ring contact:', error)
    return NextResponse.json({ error: 'Failed to remove contact' }, { status: 500 })
  }
}
