/**
 * Browser native WebSocket client for Ring Tunnel transport.
 */

import { EventEmitter } from 'events';
import { MessageConverter } from '../protocol';
import type { TunnelMessage } from '../types';
import { decodeFrame, encodeFrame, type TunnelWsClientFrame, type TunnelWsServerFrame } from './frames';

export interface NativeWsClientConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export type NativeWsClientState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  reconnectAttempts: number;
  isAuthenticated: boolean;
  lastError?: string;
};

export class NativeWsClient extends EventEmitter {
  private socket: WebSocket | null = null;
  private config: Required<NativeWsClientConfig>;
  private state: NativeWsClientState = {
    status: 'disconnected',
    reconnectAttempts: 0,
    isAuthenticated: false,
  };
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private subscribedChannels = new Set<string>();
  private token: string | null = null;

  constructor(config: NativeWsClientConfig) {
    super();
    this.config = {
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      url: config.url,
    };
  }

  getState(): NativeWsClientState {
    return { ...this.state };
  }

  get isConnected(): boolean {
    return this.state.status === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  private async fetchToken(): Promise<string> {
    const response = await fetch('/api/tunnel/token', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Tunnel token failed: ${response.status}`);
    }
    const data = (await response.json()) as { token: string };
    return data.token;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.state.status = 'connecting';
    this.emit('connecting');

    try {
      this.token = await this.fetchToken();
      const url = new URL(this.config.url, typeof window !== 'undefined' ? window.location.origin : undefined);
      this.socket = new WebSocket(url.toString());

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 15000);

        this.socket!.onopen = () => {
          clearTimeout(timeout);
          this.socket!.send(encodeFrame({ op: 'auth', token: this.token! }));
        };

        this.socket!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection error'));
        };

        this.socket!.onclose = () => {
          if (this.state.status === 'connecting') {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed before auth'));
          }
        };

        this.socket!.onmessage = (event) => {
          const frame = decodeFrame(String(event.data));
          if (!frame) return;

          if (frame.op === 'auth_ok') {
            this.state.status = 'connected';
            this.state.isAuthenticated = true;
            this.state.reconnectAttempts = 0;
            this.startHeartbeat();
            for (const channel of this.subscribedChannels) {
              this.sendFrame({ op: 'subscribe', channel });
            }
            this.emit('connected');
            resolve();
            return;
          }

          if (frame.op === 'error' && this.state.status === 'connecting') {
            clearTimeout(timeout);
            reject(new Error((frame as { message: string }).message));
            return;
          }

          if (
            frame.op === 'message' ||
            frame.op === 'pong' ||
            frame.op === 'error' ||
            frame.op === 'binary'
          ) {
            this.handleServerFrame(frame as TunnelWsServerFrame);
          }
        };
      });
    } catch (error) {
      this.state.status = 'error';
      this.state.lastError = error instanceof Error ? error.message : 'Connection failed';
      this.emit('error', error);
      throw error;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.state.status = 'disconnected';
    this.state.isAuthenticated = false;
    this.emit('disconnected');
  }

  subscribe(channel: string): void {
    this.subscribedChannels.add(channel);
    if (this.isConnected) {
      this.sendFrame({ op: 'subscribe', channel });
    }
  }

  unsubscribe(channel: string): void {
    this.subscribedChannels.delete(channel);
    if (this.isConnected) {
      this.sendFrame({ op: 'unsubscribe', channel });
    }
  }

  publish(channel: string, event: string, payload: unknown): void {
    if (!this.isConnected) {
      throw new Error('NativeWsClient: not connected');
    }
    this.sendFrame({ op: 'publish', channel, event, payload });
  }

  private sendFrame(frame: TunnelWsClientFrame): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeFrame(frame));
    }
  }

  private handleServerFrame(frame: TunnelWsServerFrame): void {
    if (frame.op === 'pong') {
      this.emit('pong', frame.id);
      return;
    }
    if (frame.op === 'message') {
      const message = frame.data?.id
        ? frame.data
        : MessageConverter.fromNativeWs(frame.data);
      this.emit('message', message);
      if (message.event === 'notification' || message.type === 'notification') {
        this.emit('notification', message.payload ?? message);
      }
      return;
    }
    if (frame.op === 'error') {
      this.emit('error', new Error(frame.message));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      const id = `ping-${Date.now()}`;
      const start = Date.now();
      const onPong = (pongId: string) => {
        if (pongId === id) {
          this.off('pong', onPong);
          this.emit('latency', Date.now() - start);
        }
      };
      this.on('pong', onPong);
      this.sendFrame({ op: 'ping', id });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
