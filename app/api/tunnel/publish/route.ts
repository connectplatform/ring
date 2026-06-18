/**
 * Tunnel Publish Endpoint
 * Client transports POST here; hub fans out to SSE + poll registries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';
import type { TunnelMessage } from '@/lib/tunnel/types';

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);

  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = authResult;

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
