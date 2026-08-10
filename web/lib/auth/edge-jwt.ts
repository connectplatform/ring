/**
 * Edge Runtime Compatible JWT Verification
 * Lightweight JWT verification for Edge Runtime environments
 */

import { SignJWT, jwtVerify } from 'jose';

/**
 * Read secrets at runtime via dynamic keys.
 * Next.js inlines `process.env.AUTH_SECRET` when that var is present during
 * `next build` (Docker uses a placeholder). Static access would mint tunnel
 * JWTs with the placeholder while native WSS (tsx `server.ts`) verifies with
 * the real K8s secret → JWSSignatureVerificationFailed / "closed before auth".
 */
function runtimeSecret(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// Tunnel/WebSocket JWT signing — optional dedicated secret, falls back to Auth.js secret
const getJwtSecret = () => {
  const secret =
    runtimeSecret('TUNNEL_JWT_SECRET') ||
    runtimeSecret('AUTH_SECRET') ||
    runtimeSecret('NEXTAUTH_SECRET');
  if (!secret) {
    throw new Error(
      'TUNNEL_JWT_SECRET, AUTH_SECRET, or NEXTAUTH_SECRET must be set for tunnel token signing'
    );
  }
  // Refuse the Docker build placeholder if it somehow reaches runtime.
  if (secret === 'ring-docker-build-placeholder-not-for-runtime') {
    throw new Error(
      'Tunnel JWT secret is the Docker build placeholder — set AUTH_SECRET (or TUNNEL_JWT_SECRET) at runtime'
    );
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
      // Auth.js v5 default session cookie is encrypted (JWE), not HS256 JWT.
      // Callers should resolve the user via auth() — see verifyAuth().
      return null;
    }
  } catch (error) {
    console.error('Session token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify authentication from request.
 * Prefer Auth.js `auth()` for session cookies (JWE/encrypted sessions cannot be
 * jwtVerify'd). Fall back to Bearer / query tunnel JWTs for WS/SSE frames.
 */
export async function verifyAuth(request: Request): Promise<{ userId: string; email?: string } | null> {
  // Check for Bearer token in Authorization header (tunnel JWT)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = await verifyJWT(token);
    if (result) return result;
  }

  // Check for token in query parameters (tunnel JWT)
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    const result = await verifyJWT(token);
    if (result) return result;
  }

  // Auth.js session (handles encrypted JWE cookies — do NOT jwtVerify the cookie)
  try {
    const { auth } = await import('@/auth');
    const session = await auth();
    if (session?.user?.id) {
      return {
        userId: session.user.id,
        email: session.user.email ?? undefined,
      };
    }
  } catch {
    // Non-route / edge contexts without auth() — fall through to legacy cookie JWT
  }

  // Legacy: unencrypted JWT session cookies only (rare; Auth.js v5 default is JWE)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      })
    );

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
