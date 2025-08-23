/**
 * Tunnel Unsubscribe Endpoint
 * Manages channel unsubscriptions for SSE and polling transports
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { subscriptionHelpers } from '../subscribe/route';

// Edge Runtime configuration
export const runtime = 'edge';

/**
 * POST handler to unsubscribe from channels
 */
export async function POST(request: NextRequest) {
  // Try to authenticate the request (optional for public unsubscriptions)
  const authResult = await verifyAuth(request);
  
  // Allow anonymous unsubscriptions
  let userId: string;
  
  if (authResult) {
    userId = authResult.userId;
  } else {
    // For anonymous users, we need some identifier
    // In production, this would be tracked via session or connection ID
    userId = `anon-${request.headers.get('x-client-id') || 'unknown'}`;
  }

  try {
    const body = await request.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel is required' },
        { status: 400 }
      );
    }

    // Remove user subscription
    const userSubs = subscriptionHelpers.getUserSubscriptions(userId);
    if (userSubs instanceof Set) {
      userSubs.delete(channel);
    }

    // Remove from channel subscribers
    const channelSubs = subscriptionHelpers.getChannelSubscribers(channel);
    if (channelSubs instanceof Set) {
      channelSubs.delete(userId);
    }

    return NextResponse.json({
      success: true,
      channel,
      subscribed: false,
    });
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
