/**
 * Tunnel Unsubscribe Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);

  let userId: string;

  if (authResult) {
    userId = authResult.userId;
  } else {
    userId = `anon-${request.headers.get('x-client-id') || 'unknown'}`;
  }

  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    getTunnelHub().unsubscribeChannel(userId, channel);

    return NextResponse.json({
      success: true,
      channel,
      subscribed: false,
    });
  } catch (error) {
    console.error('Failed to unsubscribe:', error);

    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
