import { NextResponse, connection } from 'next/server'
import { getVerificationQueue } from '@/features/verification/services/get-verification-queue'
import { EntityPermissionError } from '@/lib/errors'

/**
 * GET /api/admin/verification/queue
 */
export async function GET() {
  await connection()

  try {
    const queue = await getVerificationQueue()
    return NextResponse.json({ success: true, queue })
  } catch (error) {
    if (error instanceof EntityPermissionError) {
      const status = error.message.includes('Authentication') ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
