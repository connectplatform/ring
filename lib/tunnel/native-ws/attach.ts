/**
 * Attach native WebSocket (ws) upgrade handler to an HTTP server.
 * Server-only — imported from server.ts entrypoint.
 */

import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifyJWT } from '@/lib/auth/edge-jwt';
import { buildTunnelMessage } from '../hub';
import type { TunnelHub } from '../hub/types';
import { TunnelMessageType } from '../types';
import { decodeFrame, encodeFrame, type TunnelWsClientFrame } from './frames';

export interface AttachTunnelWssOptions {
  path?: string;
  hub: TunnelHub;
}

interface WsSession {
  userId: string;
  subscriptions: Set<string>;
}

const OPEN = 1;

function sendJson(ws: WebSocket, frame: Record<string, unknown>): void {
  if (ws.readyState === OPEN) {
    ws.send(encodeFrame(frame as Parameters<typeof encodeFrame>[0]));
  }
}

export function attachTunnelWss(server: HttpServer, options: AttachTunnelWssOptions): WebSocketServer {
  const path = options.path ?? '/api/tunnel/ws';
  const hub = options.hub;
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new WeakMap<WebSocket, WsSession>();

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname !== path) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    let authed = false;

    ws.on('message', async (raw) => {
      const text = typeof raw === 'string' ? raw : raw.toString();
      const frame = decodeFrame(text) as TunnelWsClientFrame | null;
      if (!frame) {
        sendJson(ws, { op: 'error', code: 'INVALID_FRAME', message: 'Invalid JSON frame' });
        return;
      }

      if (frame.op === 'auth') {
        const verified = await verifyJWT(frame.token);
        if (!verified?.userId) {
          sendJson(ws, { op: 'error', code: 'AUTH_FAILED', message: 'Authentication failed' });
          ws.close();
          return;
        }
        authed = true;
        sessions.set(ws, { userId: verified.userId, subscriptions: new Set() });
        hub.registerWsConnection(verified.userId, ws);
        sendJson(ws, { op: 'auth_ok', userId: verified.userId });
        return;
      }

      if (!authed) {
        sendJson(ws, { op: 'error', code: 'UNAUTHORIZED', message: 'Send auth frame first' });
        return;
      }

      const session = sessions.get(ws);
      if (!session) return;

      switch (frame.op) {
        case 'subscribe': {
          session.subscriptions.add(frame.channel);
          hub.subscribeChannel(session.userId, frame.channel);
          break;
        }
        case 'unsubscribe': {
          session.subscriptions.delete(frame.channel);
          hub.unsubscribeChannel(session.userId, frame.channel);
          break;
        }
        case 'publish': {
          const message = buildTunnelMessage(frame.channel, frame.event, frame.payload, {
            userId: session.userId,
            type: TunnelMessageType.DATA,
          });
          hub.publishToChannel(frame.channel, message);
          break;
        }
        case 'ping': {
          sendJson(ws, { op: 'pong', id: frame.id });
          break;
        }
        default:
          break;
      }
    });

    ws.on('close', () => {
      const session = sessions.get(ws);
      if (session) {
        hub.unregisterWsConnection(session.userId, ws);
        for (const channel of session.subscriptions) {
          hub.unsubscribeChannel(session.userId, channel);
        }
      }
    });
  });

  return wss;
}
