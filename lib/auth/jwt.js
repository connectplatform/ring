import { jwtVerify } from 'jose'

export async function verifyJwtToken(token, secret) {
  const secretKey = secret || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secretKey) {
    throw new Error('AUTH_SECRET/NEXTAUTH_SECRET not configured')
  }
  const encoder = new TextEncoder()
  const { payload } = await jwtVerify(token, encoder.encode(secretKey))
  return payload
}
