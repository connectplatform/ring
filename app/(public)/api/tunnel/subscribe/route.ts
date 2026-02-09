/**
 * Tunnel Subscribe Endpoint
 * Manages channel subscriptions for SSE and polling transports
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';

// Edge Runtime configuration

// Subscription tracking (in production, use Redis/Supabase/Firebase)
const userSubscriptions = new Map<string, Set<string>>();
const channelSubscribers = new Map<string, Set<string>>();

/**
 * POST handler to subscribe to channels
 */
export async function POST(request: NextRequest) {
  // Try to authenticate the request (optional for public subscriptions)
  const authResult = await verifyAuth(request);
  
  // Allow anonymous subscriptions with a generated ID
  let userId: string;
  
  if (authResult) {
    userId = authResult.userId;
  } else {
    // Generate anonymous user ID for this subscription
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    const body = await request.json();
    const { channel, events, presence, history } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel is required' },
        { status: 400 }
      );
    }

    // Track user subscription
    if (!userSubscriptions.has(userId)) {
      userSubscriptions.set(userId, new Set());
    }
    userSubscriptions.get(userId)!.add(channel);

    // Track channel subscribers
    if (!channelSubscribers.has(channel)) {
      channelSubscribers.set(channel, new Set());
    }
    channelSubscribers.get(channel)!.add(userId);

    // TODO: Handle presence and history options
    // In production, these would interact with a database or cache

    return NextResponse.json({
      success: true,
      channel,
      subscribed: true,
      subscriberCount: channelSubscribers.get(channel)?.size || 0,
    });
  } catch (error) {
    console.error('Failed to subscribe:', error);
    
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}

// Export subscription helpers
export const subscriptionHelpers = {
  getUserSubscriptions: (userId: string) => userSubscriptions.get(userId) || new Set(),
  getChannelSubscribers: (channel: string) => channelSubscribers.get(channel) || new Set(),
  isUserSubscribed: (userId: string, channel: string) => {
    const subs = userSubscriptions.get(userId);
    return subs ? subs.has(channel) : false;
  },
};
