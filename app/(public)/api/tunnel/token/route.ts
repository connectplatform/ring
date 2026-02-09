/**
 * Tunnel Token Generation Endpoint
 * Generates JWT tokens for WebSocket/SSE authentication
 * Edge Runtime compatible
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, createTunnelToken } from '@/lib/auth/edge-jwt';

// Edge Runtime configuration

/**
 * POST handler to generate tunnel authentication token
 */
export async function POST(request: NextRequest) {
  // Try to verify authentication, but allow anonymous connections
  const authResult = await verifyAuth(request);
  
  // For anonymous users, generate a temporary anonymous token
  if (!authResult) {
    try {
      // Generate anonymous user token with limited capabilities
      const anonymousId = `anon-${Math.random().toString(36).substr(2, 9)}`;
      const token = await createTunnelToken(anonymousId, undefined);
      
      return NextResponse.json({
        token,
        userId: anonymousId,
        email: undefined,
        anonymous: true,
        expiresIn: 3600, // 1 hour for anonymous tokens
      });
    } catch (error) {
      console.error('Failed to generate anonymous tunnel token:', error);
      
      return NextResponse.json(
        { error: 'Failed to generate anonymous token' },
        { status: 500 }
      );
    }
  }

  const { userId, email } = authResult;

  try {
    // Generate a new tunnel token for authenticated user
    const token = await createTunnelToken(userId, email);
    
    return NextResponse.json({
      token,
      userId,
      email,
      anonymous: false,
      expiresIn: 86400, // 24 hours in seconds for authenticated users
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
