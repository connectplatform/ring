/**
 * Tunnel Token Generation Endpoint
 * Guests: stable `anon-*` via shared ring_tunnel_anon cookie helper.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, createTunnelToken } from '@/lib/auth/edge-jwt';
import {
  attachAnonymousTunnelCookie,
  resolveAnonymousTunnelId,
  TUNNEL_ANON_COOKIE,
} from '@/lib/tunnel/anon-identity';

export { TUNNEL_ANON_COOKIE };

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);

  if (!authResult) {
    try {
      const { id: anonymousId, isNew } = resolveAnonymousTunnelId(request);
      const token = await createTunnelToken(anonymousId, undefined);

      const response = NextResponse.json({
        token,
        userId: anonymousId,
        email: undefined,
        anonymous: true,
        expiresIn: 3600,
      });
      if (isNew) {
        attachAnonymousTunnelCookie(response, anonymousId);
      }
      return response;
    } catch (error) {
      console.error('Failed to generate anonymous tunnel token:', error);

      return NextResponse.json(
        { error: 'Failed to generate anonymous token' },
        { status: 500 },
      );
    }
  }

  const { userId, email } = authResult;

  try {
    const token = await createTunnelToken(userId, email);

    return NextResponse.json({
      token,
      userId,
      email,
      anonymous: false,
      expiresIn: 86400,
    });
  } catch (error) {
    console.error('Failed to generate tunnel token:', error);

    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const authHeader = request.headers.get('authorization');

  const tokenToVerify =
    token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!tokenToVerify) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const authResult = await verifyAuth(request);

  if (!authResult) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    userId: authResult.userId,
    email: authResult.email,
  });
}
