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
import { classifyUserQueueChannel } from '../hub/queue-routing';
import { decodeFrame, deliverMessageToWs, encodeFrame, type TunnelWsClientFrame } from './frames';
import {
  authorizeTunnelChannel,
  isAnonymousTunnelUserId,
} from '../channel-acl';

export interface AttachTunnelWssOptions {
  path?: string;
  hub: TunnelHub;
  /**
   * When false, only create the WSS + connection handlers; caller must route
   * `upgrade` (needed so Next.js `getRequestHandler` cannot register a second
   * upgrade listener that destroys tunnel sockets after 101).
   */
  bindUpgrade?: boolean;
}

export interface AttachTunnelWssResult {
  wss: WebSocketServer;
  path: string;
  handleUpgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
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

export function attachTunnelWss(
  server: HttpServer,
  options: AttachTunnelWssOptions,
): AttachTunnelWssResult {
  const path = options.path ?? '/api/tunnel/ws';
  const hub = options.hub;
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new WeakMap<WebSocket, WsSession>();

  const handleUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  };

  if (options.bindUpgrade !== false) {
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== path) {
        return;
      }
      handleUpgrade(request, socket, head);
    });
  }

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

        // Drop stale account:status offline backlog on fresh auth — prevents replay storms on /profile.
        hub.clearUserSideEffectQueue(verified.userId);

        // Replay telemetry + general inbox only — side-effect channels (account:status)
        // drain on subscribe so stale reactivate notifications cannot refresh-storm /profile.
        const depth = hub.getUserOfflineQueueDepth(verified.userId);
        if (process.env.NODE_ENV === 'development' && (depth.telemetry + depth.general + depth.sideEffect) > 0) {
          console.debug(JSON.stringify({
            tag: 'tunnel.drain',
            userId: verified.userId,
            depth,
            phase: 'auth_ok',
          }));
        }
        for (const queued of hub.drainUserTelemetryQueue(verified.userId)) {
          deliverMessageToWs(ws, queued);
        }
        for (const queued of hub.drainUserGeneralQueue(verified.userId)) {
          deliverMessageToWs(ws, queued);
        }
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
          if (typeof frame.channel !== 'string') {
            sendJson(ws, { op: 'error', code: 'INVALID_FRAME', message: 'channel required' });
            break;
          }
          try {
            const decision = await authorizeTunnelChannel('subscribe', frame.channel, {
              userId: session.userId,
              isAuthenticated: !isAnonymousTunnelUserId(session.userId),
            });
            if (decision.ok === false) {
              sendJson(ws, {
                op: 'error',
                code: decision.code,
                message: decision.message,
              });
              break;
            }
          } catch (err) {
            console.error('tunnel ws: subscribe ACL failed', err);
            sendJson(ws, { op: 'error', code: 'FORBIDDEN', message: 'Subscribe denied' });
            break;
          }
          session.subscriptions.add(frame.channel);
          hub.subscribeChannel(session.userId, frame.channel);
          if (classifyUserQueueChannel(frame.channel) === 'sideEffect') {
            const sideEffects = hub.drainUserSideEffectQueue(session.userId);
            if (process.env.NODE_ENV === 'development' && sideEffects.length > 0) {
              console.debug(JSON.stringify({
                tag: 'tunnel.drain',
                userId: session.userId,
                channel: frame.channel,
                batchSize: sideEffects.length,
                phase: 'subscribe',
              }));
            }
            for (const queued of sideEffects) {
              deliverMessageToWs(ws, queued);
            }
          }
          break;
        }
        case 'unsubscribe': {
          session.subscriptions.delete(frame.channel);
          hub.unsubscribeChannel(session.userId, frame.channel);
          break;
        }
        case 'publish': {
          if (typeof frame.channel !== 'string') {
            sendJson(ws, { op: 'error', code: 'INVALID_FRAME', message: 'channel required' });
            break;
          }
          try {
            const pubDecision = await authorizeTunnelChannel('publish', frame.channel, {
              userId: session.userId,
              isAuthenticated: !isAnonymousTunnelUserId(session.userId),
            });
            if (pubDecision.ok === false) {
              sendJson(ws, {
                op: 'error',
                code: pubDecision.code,
                message: pubDecision.message,
              });
              break;
            }
          } catch (err) {
            console.error('tunnel ws: publish ACL failed', err);
            sendJson(ws, { op: 'error', code: 'FORBIDDEN', message: 'Publish denied' });
            break;
          }
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

  return { wss, path, handleUpgrade };
}
