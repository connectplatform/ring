/**
 * Tunnel Publish Endpoint
 * Client transports POST here; hub fans out to SSE + poll registries.
 * ACL: lib/tunnel/channel-acl.ts (game participants; inbox client-publish denied).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';
import type { TunnelMessage } from '@/lib/tunnel/types';
import {
  authorizeTunnelChannel,
  isAnonymousTunnelUserId,
} from '@/lib/tunnel/channel-acl';

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);

  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = authResult;
  const isAuthenticated = !isAnonymousTunnelUserId(userId);

  try {
    const body = await request.json();
    const { channel, event, message } = body as {
      channel: string;
      event?: string;
      message: TunnelMessage;
    };

    if (!channel || !message) {
      return NextResponse.json({ error: 'Channel and message are required' }, { status: 400 });
    }

    const decision = await authorizeTunnelChannel('publish', channel, {
      userId,
      isAuthenticated,
    });
    if (decision.ok === false) {
      return NextResponse.json(
        {
          error: decision.code === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden',
          channel,
          message: decision.message,
        },
        { status: decision.httpStatus },
      );
    }

    const hub = getTunnelHub();
    const envelope: TunnelMessage = {
      ...message,
      channel,
      event: event ?? message.event,
      metadata: {
        ...message.metadata,
        timestamp: message.metadata?.timestamp ?? Date.now(),
        publishedBy: userId,
        publishedAt: Date.now(),
      },
    };

    hub.publishToChannel(channel, envelope);

    return NextResponse.json({
      success: true,
      channel,
      event,
      messageId: envelope.id,
    });
  } catch (error) {
    console.error('Failed to publish message:', error);

    return NextResponse.json({ error: 'Failed to publish message' }, { status: 500 });
  }
}
