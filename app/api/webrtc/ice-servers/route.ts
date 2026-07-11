import { NextResponse, connection } from 'next/server'
import { auth } from '@/auth'

type IceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

/**
 * Authenticated ICE server config for future WebRTC calls.
 * TURN credentials stay server-side (never NEXT_PUBLIC_*).
 */
export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stunUrl = process.env.WEBRTC_STUN_URL || 'stun:stun.l.google.com:19302'
  const turnUrl = process.env.WEBRTC_TURN_URL
  const turnUsername = process.env.WEBRTC_TURN_USERNAME
  const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL

  const iceServers: IceServer[] = [{ urls: stunUrl }]

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      iceServers,
      turnConfigured: Boolean(turnUrl && turnUsername && turnCredential),
    },
  })
}
