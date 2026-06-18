/**
 * Long-Polling API Endpoint
 * Reads pending messages from TunnelHub (shared with SSE broker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);

  let userId: string;

  if (authResult) {
    userId = authResult.userId;
  } else {
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
  }

  const url = new URL(request.url);
  const lastMessageId = url.searchParams.get('lastMessageId');
  const channels = url.searchParams.get('channels')?.split(',').filter(Boolean) || [];
  const timeout = parseInt(url.searchParams.get('timeout') || '30000', 10);

  const hub = getTunnelHub();

  if (channels.length > 0) {
    hub.setPollSubscriptions(userId, channels);
  }

  const startTime = Date.now();
  const maxWaitTime = Math.min(timeout, 20000);

  const collect = () => hub.collectPollMessages(userId, channels, lastMessageId);

  let newMessages = collect();

  if (newMessages.length > 0) {
    const lastMsg = newMessages[newMessages.length - 1];
    hub.setPollLastMessageId(userId, lastMsg.id);
    hub.clearPollDelivered(userId, channels);

    return NextResponse.json({
      messages: newMessages,
      lastMessageId: lastMsg.id,
      timestamp: Date.now(),
    });
  }

  const messages2 = await new Promise<typeof newMessages>((resolve) => {
    const checkInterval = setInterval(() => {
      const pending = collect();
      if (pending.length > 0 || Date.now() - startTime >= maxWaitTime) {
        clearInterval(checkInterval);
        resolve(pending);
      }
    }, 100);
  });

  if (messages2.length > 0) {
    const lastMsg = messages2[messages2.length - 1];
    hub.setPollLastMessageId(userId, lastMsg.id);
    hub.clearPollDelivered(userId, channels);
  }

  return NextResponse.json({
    messages: messages2,
    lastMessageId: messages2.length > 0 ? messages2[messages2.length - 1].id : lastMessageId,
    timestamp: Date.now(),
  });
}
