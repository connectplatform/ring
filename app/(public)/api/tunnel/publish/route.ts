/**
 * Tunnel Publish Endpoint
 * Allows publishing messages to channels via HTTP POST
 * Used by unidirectional transports (SSE, polling)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { sseHelpers } from '../sse/route';
import { pollHelpers } from '../poll/route';

// Edge Runtime configuration

/**
 * POST handler to publish messages
 */
export async function POST(request: NextRequest) {
  // Authenticate the request
  const authResult = await verifyAuth(request);
  
  if (!authResult) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { userId } = authResult;

  try {
    const body = await request.json();
    const { channel, event, message } = body;

    if (!channel || !message) {
      return NextResponse.json(
        { error: 'Channel and message are required' },
        { status: 400 }
      );
    }

    // Broadcast to SSE connections
    if (typeof sseHelpers.broadcastToChannel === 'function') {
      sseHelpers.broadcastToChannel(channel, {
        ...message,
        channel,
        event,
        metadata: {
          ...message.metadata,
          publishedBy: userId,
          publishedAt: Date.now(),
        },
      });
    }

    // Queue for polling connections
    if (typeof pollHelpers.broadcastToChannel === 'function') {
      pollHelpers.broadcastToChannel(channel, {
        ...message,
        channel,
        event,
        metadata: {
          ...message.metadata,
          publishedBy: userId,
          publishedAt: Date.now(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      channel,
      event,
      messageId: message.id,
    });
  } catch (error) {
    console.error('Failed to publish message:', error);
    
    return NextResponse.json(
      { error: 'Failed to publish message' },
      { status: 500 }
    );
  }
}
