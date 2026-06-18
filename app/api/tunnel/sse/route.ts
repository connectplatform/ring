/**
 * SSE (Server-Sent Events) API Endpoint
 * Edge registers connections with TunnelHub; hub owns fan-out registries.
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';
import { createTunnelMessage, TunnelMessageType, MessageConverter } from '@/lib/tunnel/protocol';
import { TunnelProvider } from '@/lib/tunnel/types';
import { getTunnelHub } from '@/lib/tunnel/hub';

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);

  let userId: string;
  let email: string | undefined;

  if (authResult) {
    userId = authResult.userId;
    email = authResult.email;
  } else {
    userId = `anon-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[SSE] Anonymous connection:', userId);
  }

  const hub = getTunnelHub();
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      streamController = controller;
      hub.registerSseConnection(userId, controller);

      const connectMessage = createTunnelMessage(
        TunnelMessageType.AUTH,
        { userId, email, connected: true },
        { provider: TunnelProvider.SSE },
      );

      controller.enqueue(encoder.encode(MessageConverter.toSSE(connectMessage)));

      const queued = hub.drainUserQueueForSse(userId, 10);
      for (const message of queued) {
        controller.enqueue(encoder.encode(MessageConverter.toSSE(message)));
      }

      let heartbeatIntervalMs = 30000;
      let consecutiveHeartbeats = 0;
      let heartbeatInterval: NodeJS.Timeout;

      const sendHeartbeat = () => {
        try {
          const heartbeat = createTunnelMessage(
            TunnelMessageType.HEARTBEAT,
            { timestamp: Date.now(), sequence: consecutiveHeartbeats++ },
            { provider: TunnelProvider.SSE },
          );

          controller.enqueue(encoder.encode(MessageConverter.toSSE(heartbeat)));

          if (consecutiveHeartbeats > 5 && heartbeatIntervalMs < 120000) {
            heartbeatIntervalMs = Math.min(120000, heartbeatIntervalMs * 1.2);
          }

          heartbeatInterval = setTimeout(sendHeartbeat, heartbeatIntervalMs);
        } catch {
          clearTimeout(heartbeatInterval);
        }
      };

      heartbeatInterval = setTimeout(sendHeartbeat, heartbeatIntervalMs);

      request.signal.addEventListener('abort', () => {
        clearTimeout(heartbeatInterval);
        hub.unregisterSseConnection(userId, controller);
      });
    },

    cancel() {
      if (streamController) {
        hub.unregisterSseConnection(userId, streamController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
