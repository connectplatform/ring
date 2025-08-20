import { SignJWT } from 'jose'

/**
 * Generate a JWT token for internal authentication (WebSocket, etc.)
 * This token is signed with AUTH_SECRET and can be verified by our services
 */
export async function generateInternalJWT(userId: string, email?: string, role?: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET/NEXTAUTH_SECRET not configured')
  }

  const encoder = new TextEncoder()
  const jwt = await new SignJWT({
    sub: userId,
    email: email || '',
    role: role || 'subscriber',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(encoder.encode(secret))

  return jwt
}
