/**
 * Ring Contacts API — canonical address book for Ring users
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getCurrentRingContactsService } from '@/features/contacts/services'
import { readJsonBody } from '@/lib/server/request'
import { z } from 'zod'

const AddContactSchema = z.object({
  contactUserId: z.string().uuid(),
  notes: z.string().max(500).optional(),
})

export async function GET() {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = getCurrentRingContactsService()
    const contacts = await service.listContacts(session.user.id)

    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('Failed to list ring contacts:', error)
    return NextResponse.json({ error: 'Failed to list contacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    const parsed = AddContactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const service = getCurrentRingContactsService()
    const contact = await service.addContact(session.user.id, parsed.data)

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add contact'
    if (message.includes('Cannot add yourself')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('User not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to add ring contact:', error)
    return NextResponse.json({ error: 'Failed to add contact' }, { status: 500 })
  }
}
