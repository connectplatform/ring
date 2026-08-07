/**
 * Public VAPID key for PushManager.subscribe (RFC dual-stack).
 * Dedicated keypair — not the Firebase Console certificate.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) {
    return NextResponse.json(
      { configured: false, error: 'VAPID_PUBLIC_KEY not configured' },
      { status: 503 },
    )
  }
  return NextResponse.json({
    configured: true,
    publicKey,
    subject: process.env.VAPID_SUBJECT?.trim() || null,
  })
}
