import { jwtVerify, JWTPayload } from 'jose'

export type VerifiedToken = JWTPayload & {
  sub?: string
  email?: string
  name?: string
  picture?: string
  role?: string
}

export async function verifyJwtToken(token: string, secret?: string): Promise<VerifiedToken> {
  const secretKey = secret || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secretKey) {
    throw new Error('AUTH_SECRET/NEXTAUTH_SECRET not configured')
  }

  const encoder = new TextEncoder()
  const { payload } = await jwtVerify(token, encoder.encode(secretKey))
  return payload as VerifiedToken
}


