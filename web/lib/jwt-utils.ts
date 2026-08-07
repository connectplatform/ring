import { jwtVerify, SignJWT } from 'jose';

/**
 * JWT Secret key for token signing and verification
 * Falls back to a default key if AUTH_SECRET is not configured
 */
const JWT_SECRET = process.env.AUTH_SECRET || 'your-secret-key';

/**
 * Verify and decode a JWT token
 * 
 * @param token - The JWT token string to verify
 * @returns The decoded payload if valid, null if invalid or expired
 * 
 * @example
 * ```typescript
 * const payload = await verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
 * if (payload) {
 *   console.log('User ID:', payload.sub);
 * }
 * ```
 */
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Create a new JWT token with the provided payload
 * 
 * @param payload - The data to encode in the JWT token
 * @returns A signed JWT token string with 1-hour expiration
 * 
 * @example
 * ```typescript
 * const token = await createToken({
 *   sub: 'user123',
 *   email: 'user@example.com',
 *   role: 'admin'
 * });
 * ```
 */
export async function createToken(payload: any) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
  return token;
}

