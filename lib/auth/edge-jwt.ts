/**
 * Edge Runtime Compatible JWT Verification
 * Lightweight JWT verification for Edge Runtime environments
 */

import { SignJWT, jwtVerify } from 'jose';

// Get secret from environment
const getJwtSecret = () => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be set');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Verify a JWT token in Edge Runtime
 */
export async function verifyJWT(token: string): Promise<{ userId: string; email?: string } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Extract user information from payload
    const userId = payload.sub || payload.userId as string;
    const email = payload.email as string | undefined;

    if (!userId) {
      return null;
    }

    return { userId, email };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Create a JWT token for WebSocket/SSE authentication
 */
export async function createJWT(userId: string, email?: string): Promise<string> {
  const secret = getJwtSecret();
  
  const jwt = await new SignJWT({
    sub: userId,
    email,
    purpose: 'tunnel-auth',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

  return jwt;
}

/**
 * Verify session token from Auth.js cookies
 * This is a simplified version for Edge Runtime
 */
export async function verifySessionToken(sessionToken: string): Promise<{ userId: string; email?: string } | null> {
  try {
    // Auth.js session tokens are JWT tokens signed with AUTH_SECRET
    const secret = getJwtSecret();
    
    // Try to verify as JWT first
    try {
      const { payload } = await jwtVerify(sessionToken, secret, {
        algorithms: ['HS256'],
      });
      
      // Auth.js session structure
      if (payload.user && typeof payload.user === 'object') {
        const user = payload.user as any;
        return {
          userId: user.id || user.sub || payload.sub as string,
          email: user.email,
        };
      }
      
      // Fallback to standard JWT structure
      return {
        userId: payload.sub || payload.userId as string,
        email: payload.email as string | undefined,
      };
    } catch {
      // If not a JWT, it might be an encrypted session token
      // In production, you'd decrypt this using the same method Auth.js uses
      // For now, we'll try to extract user ID from the token structure
      
      // Auth.js v5 uses encrypted tokens by default
      // We need to decrypt them using the same algorithm
      // This is a placeholder - in production, implement proper decryption
      console.warn('Session token is not a JWT, likely encrypted. Implement proper decryption for production.');
      return null;
    }
  } catch (error) {
    console.error('Session token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify authentication from request
 */
export async function verifyAuth(request: Request): Promise<{ userId: string; email?: string } | null> {
  // Check for Bearer token in Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = await verifyJWT(token);
    if (result) return result;
  }

  // Check for token in query parameters
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    const result = await verifyJWT(token);
    if (result) return result;
  }

  // Check for session cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      })
    );

    // Try Auth.js session tokens (both secure and non-secure variants)
    const sessionToken = 
      cookies['authjs.session-token'] || 
      cookies['__Secure-authjs.session-token'] ||
      cookies['next-auth.session-token'] ||
      cookies['__Secure-next-auth.session-token'];

    if (sessionToken) {
      const result = await verifySessionToken(sessionToken);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Create a secure WebSocket/SSE token from an existing session
 */
export async function createTunnelToken(userId: string, email?: string): Promise<string> {
  return createJWT(userId, email);
}
