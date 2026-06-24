/**
 * Resolve a Ring contact's default on-chain wallet address (auto-ensure if missing).
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getCurrentRingContactsService } from '@/features/contacts/services'
import { readJsonBody } from '@/lib/server/request'
import { z } from 'zod'

const ResolveSchema = z.object({
  contactUserId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    const parsed = ResolveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const service = getCurrentRingContactsService()
    const address = await service.resolveRecipientWallet(parsed.data.contactUserId)

    return NextResponse.json({ address, contactUserId: parsed.data.contactUserId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve wallet'
    if (message.includes('User not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to resolve recipient wallet:', error)
    return NextResponse.json({ error: 'Failed to resolve wallet' }, { status: 500 })
  }
}
