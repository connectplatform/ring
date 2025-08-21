/**
 * WebSocket Authentication Endpoint
 * Generates a short-lived token for WebSocket authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SignJWT } from 'jose'

export async function GET(req: NextRequest) {
  try {
    // Get the session from Auth.js
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create a short-lived JWT specifically for WebSocket authentication
    const secret = process.env.AUTH_SECRET
    if (!secret) {
      console.error('AUTH_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Generate WebSocket auth token (valid for 1 hour)
    const token = await new SignJWT({
      sub: session.user.id || session.user.email,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as any).role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret))

    return NextResponse.json({
      token,
      expiresIn: 3600,
      userId: session.user.id || session.user.email,
    })
  } catch (error) {
    console.error('WebSocket auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  // Refresh WebSocket token
  return GET(req)
}
