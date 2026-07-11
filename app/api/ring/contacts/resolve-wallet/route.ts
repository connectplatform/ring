/**
 * Resolve a Ring contact's default on-chain wallet address (auto-ensure if missing).
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { getCurrentRingContactsService } from '@/features/contacts/services'
import { readJsonBody } from '@/lib/server/request'
import { db } from '@/lib/database'
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

    const contactUserId = parsed.data.contactUserId
    const service = getCurrentRingContactsService()
    const address = await service.resolveRecipientWallet(contactUserId)

    const profile = await db().findDocById<{
      name?: string | null
      username?: string | null
      photoURL?: string | null
      isVerified?: boolean
    }>('users', contactUserId)

    const row = profile.success ? profile.data : null

    return NextResponse.json({
      address,
      contactUserId,
      displayName: row?.name ?? row?.username ?? contactUserId,
      username: row?.username ?? null,
      photoURL: row?.photoURL ?? null,
      isVerified: Boolean(row?.isVerified),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve wallet'
    if (message.includes('User not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to resolve recipient wallet:', error)
    return NextResponse.json({ error: 'Failed to resolve wallet' }, { status: 500 })
  }
}
