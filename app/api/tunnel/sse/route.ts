/**
 * SSE (Server-Sent Events) API Endpoint
 * Next.js 15 streaming endpoint with React 19 support
 * Edge Runtime compatible for Vercel deployment
 */

import { NextRequest } from 'next/server';
import { createTunnelMessage, TunnelMessageType, MessageConverter } from '@/lib/tunnel/protocol';
import { TunnelProvider } from '@/lib/tunnel/types';
import { verifyAuth } from '@/lib/auth/edge-jwt';

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
  // Authenticate the request with proper JWT verification
  const authResult = await verifyAuth(request);
  
  if (!authResult) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="tunnel"',
      },
    });
  }

  const { userId, email } = authResult;

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

      // Send any queued messages
      const queue = messageQueues.get(userId!);
      if (queue && queue.length > 0) {
        for (const message of queue) {
          controller.enqueue(
            encoder.encode(MessageConverter.toSSE(message))
          );
        }
        messageQueues.delete(userId!);
      }

      // Heartbeat interval
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = createTunnelMessage(
            TunnelMessageType.HEARTBEAT,
            { timestamp: Date.now() },
            { provider: TunnelProvider.SSE }
          );
          
          controller.enqueue(
            encoder.encode(MessageConverter.toSSE(heartbeat))
          );
        } catch (error) {
          // Connection closed
          clearInterval(heartbeatInterval);
        }
      }, 30000); // 30 seconds

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        
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
