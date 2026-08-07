/**
 * Tunnel Subscribe Endpoint
 * ACL: lib/tunnel/channel-acl.ts. Guests reuse stable ring_tunnel_anon cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';
import {
  authorizeTunnelChannel,
  isAnonymousTunnelUserId,
} from '@/lib/tunnel/channel-acl';
import {
  attachAnonymousTunnelCookie,
  resolveAnonymousTunnelId,
} from '@/lib/tunnel/anon-identity';

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);

  let userId: string;
  let isAuthenticated: boolean;
  let anonIsNew = false;

  if (authResult) {
    userId = authResult.userId;
    isAuthenticated = !isAnonymousTunnelUserId(userId);
  } else {
    const anon = resolveAnonymousTunnelId(request);
    userId = anon.id;
    anonIsNew = anon.isNew;
    isAuthenticated = false;
  }

  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel || typeof channel !== 'string') {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    const decision = await authorizeTunnelChannel('subscribe', channel, {
      userId,
      isAuthenticated,
    });
    if (decision.ok === false) {
      return NextResponse.json(
        {
          error: decision.code === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden',
          channel,
          subscribed: false,
          message: decision.message,
        },
        { status: decision.httpStatus },
      );
    }

    const hub = getTunnelHub();
    hub.subscribeChannel(userId, channel);

    const response = NextResponse.json({
      success: true,
      channel,
      subscribed: true,
      subscriberCount: hub.getChannelSubscriberCount(channel),
    });
    if (anonIsNew) {
      attachAnonymousTunnelCookie(response, userId);
    }
    return response;
  } catch (error) {
    console.error('Failed to subscribe:', error);

    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
