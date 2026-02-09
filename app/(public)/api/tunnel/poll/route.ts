/**
 * Long-Polling API Endpoint
 * Edge-compatible polling endpoint with message persistence
 * Provides universal fallback for restrictive environments
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { createTunnelMessage, TunnelMessageType } from '@/lib/tunnel/protocol';
import { TunnelProvider } from '@/lib/tunnel/types';


// Edge Runtime configuration

// In-memory message queue (in production, use Redis/Supabase/Firebase)
const messageQueues = new Map<string, any[]>();
const userSubscriptions = new Map<string, Set<string>>();
const lastMessageIds = new Map<string, string>();

/**
 * GET handler for long-polling
 */
export async function GET(request: NextRequest) {
  // Try to authenticate the request (optional for public polling)
  const authResult = await verifyAuth(request);
  
  // Allow anonymous polling with a generated ID
  let userId: string;
  
  if (authResult) {
    userId = authResult.userId;
  } else {
    // Generate anonymous user ID for this poll session
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
  }
  const url = new URL(request.url);
  
  // Get parameters
  const lastMessageId = url.searchParams.get('lastMessageId');
  const channels = url.searchParams.get('channels')?.split(',').filter(Boolean) || [];
  const timeout = parseInt(url.searchParams.get('timeout') || '30000');
  
  // Update user subscriptions
  if (channels.length > 0) {
    userSubscriptions.set(userId, new Set(channels));
  }

  // Get messages for user
  const messages: any[] = [];
  const startTime = Date.now();
  // Vercel Edge functions have a 25s timeout, so we limit to 20s to be safe
  const maxWaitTime = Math.min(timeout, 20000); // Max 20 seconds for Vercel

  // Check for immediate messages
  const userQueue = messageQueues.get(userId) || [];
  const channelMessages = channels.flatMap(channel => 
    messageQueues.get(`channel:${channel}`) || []
  );
  
  const allMessages = [...userQueue, ...channelMessages];
  
  // Filter out already seen messages
  const newMessages = lastMessageId 
    ? allMessages.filter(msg => msg.id > lastMessageId)
    : allMessages;

  if (newMessages.length > 0) {
    // Return immediately if we have messages
    const lastMsg = newMessages[newMessages.length - 1];
    lastMessageIds.set(userId, lastMsg.id);
    
    // Clear processed messages
    messageQueues.set(userId, []);
    channels.forEach(channel => {
      messageQueues.delete(`channel:${channel}`);
    });

    return NextResponse.json({
      messages: newMessages,
      lastMessageId: lastMsg.id,
      timestamp: Date.now(),
    });
  }

  // Long-poll: wait for new messages
  const pollPromise = new Promise<any[]>((resolve) => {
    const checkInterval = setInterval(() => {
      // Check for new messages
      const userQueue = messageQueues.get(userId) || [];
      const channelMessages = channels.flatMap(channel => 
        messageQueues.get(`channel:${channel}`) || []
      );
      
      const newMessages = [...userQueue, ...channelMessages].filter(
        msg => !lastMessageId || msg.id > lastMessageId
      );

      if (newMessages.length > 0 || Date.now() - startTime >= maxWaitTime) {
        clearInterval(checkInterval);
        resolve(newMessages);
      }
    }, 100); // Check every 100ms
  });

  const messages2 = await pollPromise;

  if (messages2.length > 0) {
    const lastMsg = messages2[messages2.length - 1];
    lastMessageIds.set(userId, lastMsg.id);
    
    // Clear processed messages
    messageQueues.set(userId, []);
    channels.forEach(channel => {
      messageQueues.delete(`channel:${channel}`);
    });
  }

  // Return response (empty array if timeout)
  return NextResponse.json({
    messages: messages2,
    lastMessageId: messages2.length > 0 ? messages2[messages2.length - 1].id : lastMessageId,
    timestamp: Date.now(),
  });
}

/**
 * Helper function to add message to queue
 */
export function queueMessage(userId: string, message: any) {
  if (!messageQueues.has(userId)) {
    messageQueues.set(userId, []);
  }
  
  const queue = messageQueues.get(userId)!;
  queue.push({
    ...message,
    id: message.id || `${Date.now()}-${Math.random()}`,
  });
  
  // Limit queue size
  if (queue.length > 100) {
    queue.shift();
  }
}

/**
 * Helper function to broadcast to channel
 */
export function broadcastToChannel(channel: string, message: any) {
  const key = `channel:${channel}`;
  
  if (!messageQueues.has(key)) {
    messageQueues.set(key, []);
  }
  
  const queue = messageQueues.get(key)!;
  queue.push({
    ...message,
    id: message.id || `${Date.now()}-${Math.random()}`,
  });
  
  // Limit queue size
  if (queue.length > 100) {
    queue.shift();
  }
}

// Export helpers for use in other endpoints
export const pollHelpers = {
  queueMessage,
  broadcastToChannel,
  getUserSubscriptions: (userId: string) => userSubscriptions.get(userId) || new Set(),
  clearUserQueue: (userId: string) => messageQueues.delete(userId),
};
