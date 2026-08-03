import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import {
  executeTreasuryDiversify,
  getTreasuryDiversifyHealth,
} from '@/features/wallet/services/treasury-swap-service'
import { isSuperadmin } from '@/features/auth/user-role'

export async function GET() {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const health = await getTreasuryDiversifyHealth()
  return NextResponse.json(health)
}

export async function POST() {
  await connection()
  const session = await auth()
  if (!session?.user?.id || !isSuperadmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const result = await executeTreasuryDiversify({ adminUserId: session.user.id })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Diversify failed'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
