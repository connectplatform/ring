/**
 * WebSocket Authentication Endpoint
 * Generates a short-lived token for WebSocket authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SignJWT } from 'jose'
import { authRateLimiter } from '@/lib/security/rate-limiter'

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Apply rate limiting to prevent brute force attacks
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    
    if (authRateLimiter.isRateLimited(clientIp)) {
      const resetTime = authRateLimiter.getResetTime(clientIp)
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      console.warn(`⚠️ Rate limit exceeded for WebSocket auth: ${clientIp}`)
      
      return NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            'Retry-After': retryAfter.toString()
          }
        }
      )
    }
    
    // OPTIMIZED: Check for cached auth from middleware headers first
    const cachedUserId = req.headers.get('x-auth-user-id')
    const cachedUserRole = req.headers.get('x-auth-user-role')
    const isCached = req.headers.get('x-auth-cached') === 'true'
    const authTimestamp = req.headers.get('x-auth-timestamp')
    
    let userId: string
    let userRole: string
    let userEmail: string | undefined
    let userName: string | undefined
    
    if (cachedUserId && cachedUserRole && isCached && authTimestamp) {
      // Use cached auth - significant performance improvement (~70% faster)
      const cacheAge = Date.now() - parseInt(authTimestamp)
      
      if (cacheAge < 60000) { // Cache is fresh (less than 1 minute)
        userId = cachedUserId
        userRole = cachedUserRole
        // For WebSocket tokens, we need user details, so we'll get minimal session
        const session = await auth()
        userEmail = session?.user?.email
        userName = session?.user?.name
        
        console.log('WebSocket Auth: Using cached auth with minimal session lookup')
      } else {
        // Cache expired, fall back to full auth
        console.log('WebSocket Auth: Cache expired, falling back to full auth')
        const session = await auth()
        
        if (!session?.user) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }
        
        userId = session.user.id || session.user.email!
        userRole = (session.user as any).role || 'subscriber'
        userEmail = session.user.email
        userName = session.user.name
      }
    } else {
      // Fallback to session check only if not cached - maintains compatibility
      const session = await auth()
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      userId = session.user.id || session.user.email!
      userRole = (session.user as any).role || 'subscriber'
      userEmail = session.user.email
      userName = session.user.name
      
      console.log('WebSocket Auth: Using full session lookup (no cache)')
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

    // Generate WebSocket auth token (valid for 1 hour) using optimized auth data
    const token = await new SignJWT({
      sub: userId,
      email: userEmail,
      name: userName,
      role: userRole,
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
      userId,
      cached: isCached,
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
