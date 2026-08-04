/**
 * Browser native WebSocket client for Ring Tunnel transport.
 *
 * Owns self-heal reconnect: emit `reconnect` while retrying; emit `disconnected`
 * only on intentional disconnect() or when max attempts are exhausted so
 * TransportManager can fall back to SSE without racing a second connect.
 */

import { EventEmitter } from 'events';
import { MessageConverter } from '../protocol';
import { computeReconnectDelay } from '../reconnect-backoff';
import type { TunnelMessage } from '../types';
import { decodeFrame, encodeFrame, type TunnelWsClientFrame, type TunnelWsServerFrame } from './frames';

export interface NativeWsClientConfig {
  url: string;
  /** Default true — self-heal on unexpected close. */
  reconnect?: boolean;
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

type ResolvedConfig = {
  url: string;
  reconnect: boolean;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
};

export class NativeWsClient extends EventEmitter {
  private socket: WebSocket | null = null;
  private config: ResolvedConfig;
  private state: NativeWsClientState = {
    status: 'disconnected',
    reconnectAttempts: 0,
    isAuthenticated: false,
  };
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private subscribedChannels = new Set<string>();
  private token: string | null = null;
  /** When true, close must not schedule reconnect. */
  private intentionalClose = false;
  private connectPromise: Promise<void> | null = null;
  /** Bumped on disconnect / superseding connect to abort in-flight handshakes. */
  private connectGeneration = 0;
  private pendingPongHandler?: (pongId: string) => void;
  /** Rejects the in-flight WS handshake when disconnect() races connect(). */
  private activeHandshakeAbort: ((error: Error) => void) | null = null;

  constructor(config: NativeWsClientConfig) {
    super();
    this.config = {
      url: config.url,
      reconnect: config.reconnect !== false,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
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

  private emitError(error: unknown): void {
    if (this.listenerCount('error') > 0) {
      this.emit('error', error);
    } else {
      console.error('[NativeWsClient]', error);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private isConnectStale(generation: number): boolean {
    return this.intentionalClose || generation !== this.connectGeneration;
  }

  private abortError(): Error {
    return Object.assign(new Error('WebSocket connect aborted'), { name: 'AbortError' });
  }

  private detachSocketHandlers(socket: WebSocket): void {
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
  }

  private disposeSocket(): void {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    this.detachSocketHandlers(socket);
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    } catch {
      // ignore
    }
  }

  private canScheduleReconnect(): boolean {
    return (
      this.config.reconnect &&
      !this.intentionalClose &&
      this.state.reconnectAttempts < this.config.maxReconnectAttempts
    );
  }

  private scheduleReconnect(): void {
    if (!this.canScheduleReconnect()) {
      this.state.status = 'error';
      this.state.lastError = this.state.lastError ?? 'WebSocket reconnect exhausted';
      this.emit('disconnected');
      this.emitError(new Error(this.state.lastError));
      return;
    }

    this.clearReconnectTimer();
    this.state.status = 'reconnecting';
    this.state.reconnectAttempts += 1;
    this.state.isAuthenticated = false;

    const delay = computeReconnectDelay(
      this.state.reconnectAttempts,
      this.config.reconnectDelay,
    );

    this.emit('reconnect', { attempt: this.state.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.intentionalClose) return;
      void this.connect().catch((error) => {
        if (this.intentionalClose || (error instanceof Error && error.name === 'AbortError')) {
          return;
        }
        console.error('[NativeWsClient] Reconnection failed:', error);
        if (this.canScheduleReconnect()) {
          this.scheduleReconnect();
        } else if (!this.intentionalClose) {
          this.state.status = 'error';
          this.state.lastError = error instanceof Error ? error.message : 'Reconnection failed';
          this.emit('disconnected');
          this.emitError(error);
        }
      });
    }, delay);
  }

  private handleUnexpectedClose(): void {
    this.stopHeartbeat();
    this.socket = null;
    this.state.isAuthenticated = false;

    if (this.intentionalClose) {
      // disconnect() already emitted `disconnected` after detaching handlers.
      this.state.status = 'disconnected';
      return;
    }

    if (this.canScheduleReconnect()) {
      this.scheduleReconnect();
      return;
    }

    this.state.status = 'error';
    this.state.lastError = this.state.lastError ?? 'WebSocket closed';
    this.emit('disconnected');
    this.emitError(new Error(this.state.lastError));
  }

  private attachPersistentHandlers(generation: number): void {
    if (!this.socket) return;

    this.socket.onmessage = (event) => {
      if (this.isConnectStale(generation)) return;
      const frame = decodeFrame(String(event.data));
      if (!frame) return;
      if (
        frame.op === 'message' ||
        frame.op === 'pong' ||
        frame.op === 'error' ||
        frame.op === 'binary'
      ) {
        this.handleServerFrame(frame as TunnelWsServerFrame);
      }
    };

    this.socket.onclose = () => {
      this.handleUnexpectedClose();
    };

    this.socket.onerror = () => {
      // Browser fires error then close; reconnect is driven by onclose.
      this.state.lastError = 'WebSocket connection error';
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectPromise) return this.connectPromise;

    this.intentionalClose = false;
    this.clearReconnectTimer();
    const generation = ++this.connectGeneration;

    if (this.state.status !== 'reconnecting') {
      this.state.status = 'connecting';
      this.emit('connecting');
    }

    this.connectPromise = this.performConnect(generation).finally(() => {
      if (this.connectGeneration === generation) {
        this.connectPromise = null;
      }
    });

    return this.connectPromise;
  }

  private async performConnect(generation: number): Promise<void> {
    this.disposeSocket();

    try {
      this.token = await this.fetchToken();
      if (this.isConnectStale(generation)) {
        throw this.abortError();
      }

      const url = new URL(
        this.config.url,
        typeof window !== 'undefined' ? window.location.origin : undefined,
      );
      this.socket = new WebSocket(url.toString());

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 15000);
        const socket = this.socket!;

        const fail = (error: Error) => {
          clearTimeout(timeout);
          if (this.activeHandshakeAbort === fail) {
            this.activeHandshakeAbort = null;
          }
          reject(error);
        };
        this.activeHandshakeAbort = fail;

        socket.onopen = () => {
          if (this.isConnectStale(generation)) {
            fail(this.abortError());
            return;
          }
          clearTimeout(timeout);
          socket.send(encodeFrame({ op: 'auth', token: this.token! }));
        };

        socket.onerror = () => {
          fail(new Error('WebSocket connection error'));
        };

        socket.onclose = () => {
          if (this.state.status === 'connecting' || this.state.status === 'reconnecting') {
            fail(new Error('WebSocket closed before auth'));
          }
        };

        socket.onmessage = (event) => {
          const frame = decodeFrame(String(event.data));
          if (!frame) return;

          if (frame.op === 'auth_ok') {
            if (this.isConnectStale(generation)) {
              fail(this.abortError());
              return;
            }
            clearTimeout(timeout);
            this.activeHandshakeAbort = null;
            this.state.status = 'connected';
            this.state.isAuthenticated = true;
            this.state.reconnectAttempts = 0;
            this.state.lastError = undefined;
            this.attachPersistentHandlers(generation);
            this.startHeartbeat();
            for (const channel of this.subscribedChannels) {
              this.sendFrame({ op: 'subscribe', channel });
            }
            this.emit('connected');
            resolve();
            return;
          }

          if (frame.op === 'error' && this.state.status !== 'connected') {
            fail(new Error((frame as { message: string }).message));
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
      this.activeHandshakeAbort = null;
      this.stopHeartbeat();
      this.disposeSocket();
      this.state.isAuthenticated = false;

      if (this.isConnectStale(generation) || (error instanceof Error && error.name === 'AbortError')) {
        this.state.status = 'disconnected';
        throw this.abortError();
      }

      this.state.lastError = error instanceof Error ? error.message : 'Connection failed';

      // Initial connect failure: surface error. Reconnect path uses scheduleReconnect via catch in timer.
      if (this.state.status !== 'reconnecting') {
        this.state.status = 'error';
        this.emitError(error);
      }
      throw error;
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.connectGeneration += 1;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.connectPromise = null;
    const abortHandshake = this.activeHandshakeAbort;
    this.activeHandshakeAbort = null;
    abortHandshake?.(this.abortError());

    if (this.socket) {
      const socket = this.socket;
      this.detachSocketHandlers(socket);
      this.socket = null;
      try {
        socket.close();
      } catch {
        // ignore
      }
    }

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
      this.emitError(new Error(frame.message));
    }
  }

  private clearPendingPongHandler(): void {
    if (this.pendingPongHandler) {
      this.off('pong', this.pendingPongHandler);
      this.pendingPongHandler = undefined;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      this.clearPendingPongHandler();
      const id = `ping-${Date.now()}`;
      const start = Date.now();
      const onPong = (pongId: string) => {
        if (pongId === id) {
          this.clearPendingPongHandler();
          this.emit('latency', Date.now() - start);
        }
      };
      this.pendingPongHandler = onPong;
      this.on('pong', onPong);
      this.sendFrame({ op: 'ping', id });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    this.clearPendingPongHandler();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
