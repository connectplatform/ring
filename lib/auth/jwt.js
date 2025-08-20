import { jwtVerify } from 'jose'

export async function verifyJwtToken(token, secret) {
  const secretKey = secret || process.env.AUTH_SECRET
  if (!secretKey) {
    throw new Error('AUTH_SECRET not configured')
  }
  const encoder = new TextEncoder()
  const { payload } = await jwtVerify(token, encoder.encode(secretKey))
  return payload
}
