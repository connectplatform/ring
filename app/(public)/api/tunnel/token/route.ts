/**
 * Tunnel Token Generation Endpoint
 * Generates JWT tokens for WebSocket/SSE authentication
 * Edge Runtime compatible
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, createTunnelToken } from '@/lib/auth/edge-jwt';

// Edge Runtime configuration
export const runtime = 'edge';

/**
 * POST handler to generate tunnel authentication token
 */
export async function POST(request: NextRequest) {
  // Verify the user is authenticated
  const authResult = await verifyAuth(request);
  
  if (!authResult) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="tunnel"',
        },
      }
    );
  }

  const { userId, email } = authResult;

  try {
    // Generate a new tunnel token
    const token = await createTunnelToken(userId, email);
    
    return NextResponse.json({
      token,
      userId,
      email,
      expiresIn: 86400, // 24 hours in seconds
    });
  } catch (error) {
    console.error('Failed to generate tunnel token:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

/**
 * GET handler to verify tunnel token
 */
export async function GET(request: NextRequest) {
  // Extract token from query params or Authorization header
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const authHeader = request.headers.get('authorization');
  
  const tokenToVerify = token || 
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  
  if (!tokenToVerify) {
    return NextResponse.json(
      { error: 'Token required' },
      { status: 400 }
    );
  }

  // Verify the token
  const authResult = await verifyAuth(request);
  
  if (!authResult) {
    return NextResponse.json(
      { valid: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    valid: true,
    userId: authResult.userId,
    email: authResult.email,
  });
}
