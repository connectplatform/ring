import { NextRequest, NextResponse, connection} from 'next/server'
import { auth } from '@/auth'
import { createPinAccessToken } from '@/features/wallet/services/ensure-wallet'

export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    // Authenticate the user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { pin } = await request.json()

    // Validate PIN format
    if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      )
    }

    // Create PIN access token
    const { accessToken, walletAddress } = await createPinAccessToken(session.user.id, pin)

    return NextResponse.json({
      accessToken,
      walletAddress,
      expiresIn: 15 * 60 * 1000, // 15 minutes in milliseconds
      message: 'PIN verified successfully'
    })

  } catch (error: any) {
    console.error('PIN access error:', error)

    // Don't reveal if PIN was wrong or other errors for security
    return NextResponse.json(
      { error: 'PIN verification failed' },
      { status: 400 }
    )
  }
}
