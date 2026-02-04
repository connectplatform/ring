/**
 * SSE (Server-Sent Events) API Endpoint
 * Next.js 15 streaming endpoint with React 19 support
 * Edge Runtime compatible for Vercel deployment
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { createTunnelMessage, TunnelMessageType, MessageConverter } from '@/lib/tunnel/protocol';
import { TunnelProvider } from '@/lib/tunnel/types';

// Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Message queue for SSE (in production, use Redis/Supabase/Firebase)
const messageQueues = new Map<string, any[]>();
const activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * GET handler for SSE connections
 */
export async function GET(request: NextRequest) {
  // Try to authenticate the request (optional for public SSE)
  const authResult = await verifyAuth(request);
  
  // Allow anonymous connections with a generated ID
  let userId: string;
  let email: string | undefined;
  
  if (authResult) {
    userId = authResult.userId;
    email = authResult.email;
  } else {
    // Generate anonymous user ID for this connection
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[SSE] Anonymous connection:', userId);
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Add to active connections
      if (!activeConnections.has(userId!)) {
        activeConnections.set(userId!, new Set());
      }
      activeConnections.get(userId!)!.add(controller);

      // Send initial connection message
      const connectMessage = createTunnelMessage(
        TunnelMessageType.AUTH,
        { userId, email, connected: true },
        { provider: TunnelProvider.SSE }
      );
      
      controller.enqueue(
        encoder.encode(MessageConverter.toSSE(connectMessage))
      );

      // Send any queued messages (batched for performance)
      const queue = messageQueues.get(userId!);
      if (queue && queue.length > 0) {
        // Batch messages to reduce overhead
        const batchSize = Math.min(queue.length, 10); // Send up to 10 messages at once
        for (let i = 0; i < batchSize; i++) {
          controller.enqueue(
            encoder.encode(MessageConverter.toSSE(queue[i]))
          );
        }

        // Keep remaining messages in queue (don't delete entire queue)
        if (batchSize < queue.length) {
          messageQueues.set(userId!, queue.slice(batchSize));
        } else {
          messageQueues.delete(userId!);
        }
      }

      // Adaptive heartbeat interval - less frequent for stable connections
      let heartbeatIntervalMs = 30000; // Start with 30 seconds
      let consecutiveHeartbeats = 0;
      let heartbeatInterval: NodeJS.Timeout;

      const sendHeartbeat = () => {
        try {
          const heartbeat = createTunnelMessage(
            TunnelMessageType.HEARTBEAT,
            { timestamp: Date.now(), sequence: consecutiveHeartbeats++ },
            { provider: TunnelProvider.SSE }
          );

          controller.enqueue(
            encoder.encode(MessageConverter.toSSE(heartbeat))
          );

          // Gradually increase heartbeat interval for stable connections (up to 2 minutes)
          if (consecutiveHeartbeats > 5 && heartbeatIntervalMs < 120000) {
            heartbeatIntervalMs = Math.min(120000, heartbeatIntervalMs * 1.2);
          }

          // Schedule next heartbeat
          heartbeatInterval = setTimeout(sendHeartbeat, heartbeatIntervalMs);
        } catch (error) {
          // Connection closed
          clearTimeout(heartbeatInterval);
        }
      };

      // Start heartbeat
      heartbeatInterval = setTimeout(sendHeartbeat, heartbeatIntervalMs);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        if (heartbeatInterval) {
          clearTimeout(heartbeatInterval);
        }
        
        const connections = activeConnections.get(userId!);
        if (connections) {
          connections.delete(controller);
          if (connections.size === 0) {
            activeConnections.delete(userId!);
          }
        }
      });
    },

    cancel() {
      // Cleanup when client disconnects
      const connections = activeConnections.get(userId!);
      if (connections) {
        connections.forEach(controller => {
          try {
            controller.close();
          } catch (error) {
            // Already closed
          }
        });
        activeConnections.delete(userId!);
      }
    },
  });

  // Return SSE response with proper headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Broadcast message to user's SSE connections
 */
export function broadcastToUser(userId: string, message: any) {
  const connections = activeConnections.get(userId);
  
  if (connections && connections.size > 0) {
    const encoder = new TextEncoder();
    const data = encoder.encode(MessageConverter.toSSE(message));
    
    connections.forEach(controller => {
      try {
        controller.enqueue(data);
      } catch (error) {
        // Connection closed, will be cleaned up
      }
    });
  } else {
    // Queue message for when user reconnects
    if (!messageQueues.has(userId)) {
      messageQueues.set(userId, []);
    }
    
    const queue = messageQueues.get(userId)!;
    queue.push(message);
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift();
    }
  }
}

/**
 * Broadcast message to channel subscribers
 */
export function broadcastToChannel(channel: string, message: any) {
  // In production, use Redis pub/sub or database to track channel subscriptions
  // For now, broadcast to all connected users
  activeConnections.forEach((connections, userId) => {
    broadcastToUser(userId, message);
  });
}

// Export helper functions for use in other API routes
export const sseHelpers = {
  broadcastToUser,
  broadcastToChannel,
  getActiveConnections: () => activeConnections.size,
  isUserConnected: (userId: string) => activeConnections.has(userId),
};
