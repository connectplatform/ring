/**
 * Tunnel Subscribe Endpoint
 * Channel membership tracked on TunnelHub.
 * game:{sessionId} — deny-by-default; only peer_game_sessions participants.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { getTunnelHub } from '@/lib/tunnel/hub';
import { getSessionForParticipant } from '@/features/peer-games/service';

function parseGameSessionId(channel: string): string | null {
  if (!channel.startsWith('game:')) return null;
  const sessionId = channel.slice('game:'.length).trim();
  // Reject empty, nested, or path-like ids — spectate channels deferred.
  if (!sessionId || sessionId.includes(':') || sessionId.includes('/')) return null;
  return sessionId;
}

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

    if (!channel || typeof channel !== 'string') {
      return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
    }

    const gameSessionId = parseGameSessionId(channel);
    if (gameSessionId) {
      // Client-only filters are insufficient — DB participant ACL is mandatory.
      if (!authResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const session = await getSessionForParticipant(gameSessionId, userId);
      if (!session) {
        return NextResponse.json(
          { error: 'Forbidden', channel, subscribed: false },
          { status: 403 },
        );
      }
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
