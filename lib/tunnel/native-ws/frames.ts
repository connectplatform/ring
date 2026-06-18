/**
 * Native WebSocket tunnel frame protocol (JSON text frames + optional binary CRDT).
 */

import type { TunnelMessage } from '../types';

export type TunnelWsClientFrame =
  | { op: 'auth'; token: string }
  | { op: 'subscribe'; channel: string; events?: string[] }
  | { op: 'unsubscribe'; channel: string }
  | { op: 'publish'; channel: string; event: string; payload: unknown }
  | { op: 'ping'; id: string };

export type TunnelWsServerFrame =
  | { op: 'message'; data: TunnelMessage }
  | { op: 'pong'; id: string }
  | { op: 'error'; code: string; message: string }
  | { op: 'auth_ok'; userId: string }
  | { op: 'binary'; channel: string; data: string };

export function encodeFrame(frame: TunnelWsClientFrame | TunnelWsServerFrame): string {
  return JSON.stringify(frame);
}

export function decodeFrame(raw: string): TunnelWsClientFrame | TunnelWsServerFrame | null {
  try {
    const parsed = JSON.parse(raw) as { op?: string };
    if (!parsed?.op) return null;
    return parsed as TunnelWsClientFrame | TunnelWsServerFrame;
  } catch {
    return null;
  }
}

const WS_OPEN = 1;

/** Deliver a tunnel message to a native WS socket. */
export function deliverMessageToWs(
  ws: { readyState: number; send(data: string): void },
  message: TunnelMessage,
): boolean {
  if (ws.readyState !== WS_OPEN) return false;
  try {
    ws.send(encodeFrame({ op: 'message', data: message }));
    return true;
  } catch {
    return false;
  }
}
