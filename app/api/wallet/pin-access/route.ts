import { NextResponse, connection } from 'next/server'

/** @deprecated PIN access flow removed — wallets use server-side WALLET_ENCRYPTION_KEY only */
export async function POST() {
  await connection()
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'PIN access has been deprecated. Custodial signing is server-side only.',
    },
    { status: 410 },
  )
}
