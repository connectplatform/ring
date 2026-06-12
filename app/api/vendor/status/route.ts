import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { hasVendorEntity } from '@/features/entities/services/vendor-entity'

export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ hasVendor: false }, { status: 401 })
  }

  const hasVendor = await hasVendorEntity(session.user.id)
  return NextResponse.json({ hasVendor })
}
