/**
 * Tunnel Subscribe Endpoint
 * Channel membership tracked on TunnelHub.
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
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    const hub = getTunnelHub();
    hub.subscribeChannel(userId, channel);

    return NextResponse.json({
      success: true,
      channel,
      subscribed: true,
      subscriberCount: hub.getChannelSubscriberCount(channel),
    });
  } catch (error) {
    console.error('Failed to subscribe:', error);

    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
