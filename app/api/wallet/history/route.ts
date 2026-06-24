import { NextResponse, connection } from 'next/server'

/** @deprecated Use GET /api/wallet/activity instead */
export async function GET() {
  await connection()
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'Wallet history moved to /api/wallet/activity',
      replacement: '/api/wallet/activity',
    },
    { status: 410 },
  )
}
