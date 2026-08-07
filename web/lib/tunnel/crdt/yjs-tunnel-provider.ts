/**
 * Y.js provider over Ring Tunnel native WebSocket.
 */

import * as Y from 'yjs';
import type { TunnelMessage } from '../types';
import { NativeWsClient } from '../native-ws/client';
import { createAwarenessThrottle } from './awareness-throttle';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface YjsTunnelProviderOptions {
  doc: Y.Doc;
  channel: string;
  wsClient: NativeWsClient;
}

export class YjsTunnelProvider {
  private doc: Y.Doc;
  private channel: string;
  private client: NativeWsClient;
  private awarenessThrottle = createAwarenessThrottle(50);
  private onMessageBound: (message: TunnelMessage) => void;

  constructor(options: YjsTunnelProviderOptions) {
    this.doc = options.doc;
    this.channel = options.channel;
    this.client = options.wsClient;

    this.onMessageBound = this.onTunnelMessage.bind(this);

    this.awarenessThrottle.setSender((data) => {
      this.sendBinary('crdt:awareness', data);
    });

    this.doc.on('update', this.onDocUpdate);
    this.client.on('message', this.onMessageBound);
    this.client.subscribe(this.channel);
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    this.sendBinary('crdt:update', update);
  };

  private sendBinary(event: string, data: Uint8Array): void {
    if (!this.client.isConnected) return;
    this.client.publish(this.channel, event, { binary: uint8ToBase64(data) });
  }

  private onTunnelMessage(message: TunnelMessage): void {
    const channel = message.channel ?? message.metadata?.channel;
    if (channel !== this.channel) return;

    const event = message.event ?? message.type;
    const binary = (message.payload as { binary?: string } | undefined)?.binary;
    if (!binary || !event) return;

    const update = base64ToUint8(binary);
    if (event === 'crdt:update') {
      Y.applyUpdate(this.doc, update, this);
    }
  }

  destroy(): void {
    this.doc.off('update', this.onDocUpdate);
    this.client.off('message', this.onMessageBound);
    this.client.unsubscribe(this.channel);
    this.awarenessThrottle.destroy();
  }
}
